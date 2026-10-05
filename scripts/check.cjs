const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
for (const name of fs.readdirSync('extension').filter(name => name.endsWith('.js'))) {
  const code = fs.readFileSync(path.join('extension', name),'utf8');
  new vm.Script(code, {filename:name});
  assert.ok(!/storage\.sync|\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(code), 'Runtime must keep feedback local');
}
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
assert.equal(manifest.version, '0.2.0');
assert.deepEqual(manifest.content_scripts[0].js,['rules.js','detector.js','content.js']);
for (const name of [...manifest.content_scripts[0].js, manifest.background.service_worker, manifest.action.default_popup]) assert.ok(fs.existsSync(path.join('extension',name)));
const rules = JSON.parse(fs.readFileSync('extension/rules/base-rules.json','utf8'));
assert.equal(new Set(rules.map(rule => rule.id)).size,rules.length);
assert.ok(rules.every(rule => rule.action.type === 'block' && rule.priority === 1));
console.log('JavaScript syntax, manifest, static rules and local-only runtime checks passed.');
