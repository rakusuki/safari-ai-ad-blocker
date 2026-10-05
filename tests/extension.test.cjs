const test = require('node:test');
const assert = require('node:assert/strict');
const {environment} = require('./helpers.cjs');
const strong = '<div id="ad-slot" data-width="300" data-height="250" style="display:flex!important">Sponsored</div>';
const medium = '<div id="ad-review">Sponsored</div>';
const hidden = element => element.style.display === 'none';
async function itemFeedback(page, id, action) {
  const state = await page.state();
  const item = state.items.find(item => item.label.endsWith('#' + id));
  assert.ok(item, `missing item ${id}`);
  return page.command({type:'element-feedback', id:item.id, action});
}
test('unchanged heuristic: strong hides, medium stays visible across scans, semantic containers safe', async t => {
  const env = environment(); const page = env.page(strong + medium + '<main id="ad-main">Sponsored</main><div id="normal">Article</div>'); t.after(() => page.close());
  await page.state();
  const ad = page.document.getElementById('ad-slot');
  assert.equal(page.window.SafariAIAdDetector.scoreElement(ad), 1);
  assert.ok(hidden(ad));
  assert.equal(page.window.SafariAIAdDetector.scoreElement(page.document.getElementById('ad-review')), .8);
  await page.state(); await page.state();
  assert.ok(!hidden(page.document.getElementById('ad-review')));
  assert.equal(page.window.SafariAIAdDetector.scoreElement(page.document.querySelector('main')), 0);
  assert.ok(!hidden(page.document.getElementById('normal')));
  await env.send({type:'scan-result', blocked:0, review:0});
  assert.equal(env.data.blockedCount, 1); assert.equal(env.data.reviewCount, 1);
});
test('not-an-ad restores display and priority, persists after reload, isolates hosts', async t => {
  const env = environment(); const page = env.page(strong); t.after(() => page.close());
  await itemFeedback(page, 'ad-slot', 'allow');
  const ad = page.document.getElementById('ad-slot');
  assert.equal(ad.style.display, 'flex'); assert.equal(ad.style.getPropertyPriority('display'), 'important');
  assert.equal(ad.dataset.safariAiAdBlocked, undefined);
  await page.state(); assert.ok(!hidden(ad));
  const next = env.page(strong, 'https://example.com/other'); t.after(() => next.close());
  await next.state(); assert.ok(!hidden(next.document.getElementById('ad-slot')));
  const other = env.page(strong, 'https://other.example.com/'); t.after(() => other.close());
  await other.state(); assert.ok(hidden(other.document.getElementById('ad-slot')));
  assert.deepEqual(env.data['site:example.com'].allow, ['#ad-slot']);
  assert.equal(env.data['site:example.com'].falsePositives, 1);
  assert.deepEqual(Object.keys(env.data['site:example.com']).sort(), ['allow','allowlisted','block','falsePositives']);
});
test('allow rule protects ancestor and descendant from automatic or manual reblocking', async t => {
  const env = environment({'site:example.com':{allowlisted:false,block:['#ad-parent'],allow:['#keep'],falsePositives:1}});
  const page = env.page('<div id="ad-parent">Sponsored<div id="keep"><div id="ad-slot" data-width="300" data-height="250">Sponsored</div></div></div>'); t.after(() => page.close());
  await page.state();
  assert.ok(!hidden(page.document.getElementById('ad-parent'))); assert.ok(!hidden(page.document.getElementById('ad-slot')));
});
test('manual candidate block persists and reset removes manual hiding', async t => {
  const env = environment(); const page = env.page(medium); t.after(() => page.close());
  await itemFeedback(page, 'ad-review', 'block'); assert.ok(hidden(page.document.getElementById('ad-review')));
  const next = env.page(medium); t.after(() => next.close()); await next.state(); assert.ok(hidden(next.document.getElementById('ad-review')));
  await env.send({type:'site-feedback',url:'https://example.com/',action:'reset-site'});
  await next.state(); assert.ok(!hidden(next.document.getElementById('ad-review')));
});
test('picker blocks ordinary element, persists unique selector, can be cancelled', async t => {
  const env = environment(); const page = env.page('<div id="plain:box">ordinary</div>'); t.after(() => page.close()); await page.state();
  page.window.confirm = () => true;
  await page.command({type:'pick-element'});
  page.document.getElementById('plain:box').click();
  await new Promise(resolve => setImmediate(resolve)); await page.state();
  assert.ok(hidden(page.document.getElementById('plain:box')));
  const next = env.page('<div id="plain:box">ordinary</div>'); t.after(() => next.close()); await next.state();
  assert.ok(hidden(next.document.getElementById('plain:box')));
  await next.command({type:'pick-element'}); next.document.dispatchEvent(new next.window.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(next.document.documentElement.children.length, 2);
});
test('picker refuses structural page regions and cancelling selection saves nothing', async t => {
  const env = environment(); const page = env.page('<main id="region">article</main><div id="normal">normal</div>'); t.after(() => page.close()); await page.state();
  let error; page.window.alert = value => {error = value;}; page.window.confirm = () => true;
  await page.command({type:'pick-element'}); page.document.querySelector('main').click();
  assert.ok(error); assert.equal(env.data['site:example.com'], undefined);
  page.window.confirm = () => false; await page.command({type:'pick-element'}); page.document.getElementById('normal').click();
  await page.state(); assert.equal(env.data['site:example.com'], undefined);
});
test('site allowlist restores DOM and installs exact-host network exception; enable reverses it', async t => {
  const env = environment(); const page = env.page(strong + medium); t.after(() => page.close()); await page.state();
  await env.send({type:'site-feedback',url:'https://example.com/',action:'allow-site'});
  await page.state(); assert.ok(!hidden(page.document.getElementById('ad-slot'))); assert.equal(page.document.getElementById('ad-review').dataset.safariAiAdCandidate, undefined);
  const rule = env.network()[0]; assert.equal(rule.action.type, 'allowAllRequests'); assert.deepEqual(rule.condition.resourceTypes, ['main_frame']); assert.ok(rule.priority > 1);
  const regex = new RegExp(rule.condition.regexFilter);
  assert.ok(regex.test('https://example.com:443/page')); assert.ok(!regex.test('https://exampleXcom/')); assert.ok(!regex.test('https://sub.example.com/')); assert.ok(!regex.test('https://example.com.evil/'));
  await env.send({type:'site-feedback',url:'https://example.com/',action:'enable-site'}); await page.state();
  assert.ok(hidden(page.document.getElementById('ad-slot'))); assert.equal(env.network().length, 0);
});
test('DNR exceptions rehydrate on service worker startup', async () => {
  const env = environment({'site:example.com':{allowlisted:true}});
  await env.send({type:'scan-result',blocked:0,review:0}); assert.equal(env.network().length,1);
});
test('failed feedback storage leaves hidden element and rules unchanged', async t => {
  const env = environment(); const page = env.page(strong); t.after(() => page.close()); await page.state();
  env.failStorage(true); await assert.rejects(itemFeedback(page,'ad-slot','allow'), /storage failed/);
  assert.ok(hidden(page.document.getElementById('ad-slot'))); assert.equal(env.data['site:example.com'],undefined);
});
test('DNR failure rolls back site preference and reports error', async () => {
  const env = environment(); await env.send({type:'scan-result',blocked:0,review:0}); env.failNetwork(true);
  await assert.rejects(env.send({type:'site-feedback',url:'https://example.com/',action:'allow-site'}), /DNR failed/);
  assert.equal(env.data['site:example.com'].allowlisted,false);
});
test('concurrent tab feedback preserves all rules, counters and site isolation', async () => {
  const env = environment();
  await Promise.all([
    env.send({type:'site-feedback',action:'allow',selector:'#one'},{tab:{id:1},url:'https://example.com/'}),
    env.send({type:'site-feedback',action:'allow',selector:'#two'},{tab:{id:2},url:'https://example.com/'}),
    env.send({type:'site-feedback',action:'block',selector:'#other'},{tab:{id:3},url:'https://other.com/'}),
    ...Array.from({length:10}, () => env.send({type:'scan-result',blocked:1,review:1}))
  ]);
  assert.deepEqual(env.data['site:example.com'].allow,['#one','#two']); assert.equal(env.data['site:example.com'].falsePositives,2);
  assert.deepEqual(env.data['site:other.com'].block,['#other']); assert.equal(env.data.blockedCount,10); assert.equal(env.data.reviewCount,10);
});
test('late inserted ads and replacement of allowed element respect persisted rules', async t => {
  const env = environment({'site:example.com':{allowlisted:false,block:[],allow:['#keep'],falsePositives:1}});
  const page = env.page('<div id="content"></div>'); t.after(() => page.close()); await page.state();
  page.document.getElementById('content').innerHTML = strong + '<div id="keep" class="ad-slot" data-width="300" data-height="250">Sponsored</div>';
  await new Promise(resolve => setTimeout(resolve,420));
  assert.ok(hidden(page.document.getElementById('ad-slot'))); assert.ok(!hidden(page.document.getElementById('keep')));
});
test('0.85 auto-hide and 0.65 review boundaries preserve ad host and geometry evidence', async t => {
  const env = environment();
  const page = env.page('<div id="ad-fixed" style="position:fixed">Sponsored</div><iframe id="frame" src="https://doubleclick.net/banner"></iframe><iframe id="sized" src="https://doubleclick.net/banner" data-width="300" data-height="250"></iframe>'); t.after(() => page.close());
  await page.state();
  assert.ok(hidden(page.document.getElementById('ad-fixed')));
  assert.ok(!hidden(page.document.getElementById('frame')));
  assert.equal(page.document.getElementById('frame').dataset.safariAiAdCandidate, '0.65');
  assert.ok(hidden(page.document.getElementById('sized')));
  await page.state(); assert.ok(!hidden(page.document.getElementById('frame')));
});
test('restore empty display, reverse feedback and duplicate feedback preserve local counts', async t => {
  const env = environment(); const page = env.page(strong.replace(' style="display:flex!important"','')); t.after(() => page.close());
  await itemFeedback(page,'ad-slot','allow');
  assert.equal(page.document.getElementById('ad-slot').style.getPropertyValue('display'),'');
  await env.send({type:'site-feedback',url:'https://example.com/',action:'allow',selector:'#ad-slot'});
  assert.equal(env.data['site:example.com'].falsePositives,1);
  await env.send({type:'site-feedback',url:'https://example.com/',action:'block',selector:'#ad-slot'}); await page.state();
  assert.ok(hidden(page.document.getElementById('ad-slot'))); assert.deepEqual(env.data['site:example.com'].allow,[]);
  await itemFeedback(page,'ad-slot','allow'); assert.deepEqual(env.data['site:example.com'].block,[]);
});
test('ID-free structural selector persists, duplicate IDs do not create broad rule', async t => {
  const env = environment(); const markup = '<section><p>keep</p><div id="dup">one</div><div id="dup">two</div></section>';
  const page = env.page(markup); t.after(() => page.close()); await page.state(); page.window.confirm = () => true;
  await page.command({type:'pick-element'}); page.document.querySelectorAll('#dup')[1].click();
  await new Promise(resolve => setImmediate(resolve)); await page.state();
  assert.ok(!hidden(page.document.querySelectorAll('#dup')[0])); assert.ok(hidden(page.document.querySelectorAll('#dup')[1]));
  const next = env.page(markup); t.after(() => next.close()); await next.state();
  assert.ok(!hidden(next.document.querySelectorAll('#dup')[0])); assert.ok(hidden(next.document.querySelectorAll('#dup')[1]));
});
