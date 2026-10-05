const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const source = name => fs.readFileSync(`extension/${name}`, 'utf8');
function event() {
  const listeners = [];
  return { addListener: fn => listeners.push(fn), emit: (...args) => listeners.map(fn => fn(...args)) };
}
function environment(initial = {}) {
  const data = structuredClone(initial);
  const changed = event();
  const messages = event();
  let dynamic = [];
  let failStorage = false;
  let failNetwork = false;
  const storage = {
    async get(keys) {
      if (keys === null) return structuredClone(data);
      if (typeof keys === 'string') return { [keys]: structuredClone(data[keys]) };
      return Object.fromEntries(Object.entries(keys).map(([k,v]) => [k, structuredClone(data[k] ?? v)]));
    },
    async set(values) {
      if (failStorage) throw new Error('storage failed');
      const changes = {};
      for (const [key,value] of Object.entries(values)) {
        changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
        data[key] = structuredClone(value);
      }
      changed.emit(changes, 'local');
    }
  };
  const api = {
    storage: { local: storage, onChanged: changed },
    runtime: { onMessage: messages, onInstalled: event(), onStartup: event() },
    declarativeNetRequest: {
      async getDynamicRules() { return structuredClone(dynamic); },
      async updateDynamicRules({removeRuleIds, addRules}) {
        if (failNetwork) throw new Error('DNR failed');
        dynamic = dynamic.filter(rule => !removeRuleIds.includes(rule.id)).concat(structuredClone(addRules));
      }
    }
  };
  const context = vm.createContext({ browser: api, URL, console });
  context.importScripts = name => vm.runInContext(source(name), context);
  vm.runInContext(source('background.js'), context);
  const send = (message, sender = {}) => Promise.resolve(messages.emit(message, sender).find(result => result !== undefined));
  function page(html, url = 'https://example.com/page') {
    const dom = new JSDOM(html, {url, runScripts:'outside-only', pretendToBeVisual:true});
    const window = dom.window;
    window.CSS = { escape: value => value.replace(/[^a-zA-Z0-9_-]/g, character => '\\' + character) };
    window.HTMLElement.prototype.getBoundingClientRect = function() {
      return {width: Number(this.dataset.width || 0), height: Number(this.dataset.height || 0)};
    };
    const incoming = event();
    const localChanges = event();
    changed.addListener((...args) => localChanges.emit(...args));
    window.browser = {
      storage: {local:storage, onChanged:localChanges},
      runtime: {onMessage:incoming, sendMessage:message => send(message, {tab:{id:1},url})}
    };
    for (const script of ['rules.js','detector.js','content.js']) window.eval(source(script));
    return {
      window, document:window.document,
      async command(message) { return incoming.emit(message).find(result => result !== undefined); },
      async state() { return this.command({type:'page-state'}); },
      close() { window.close(); }
    };
  }
  return {data, send, page, rules:context.SafariAIRules, network:() => dynamic,
    failStorage: value => { failStorage = value; }, failNetwork: value => { failNetwork = value; }};
}
module.exports = {environment};
