"use strict";
importScripts("rules.js");
const rules = globalThis.SafariAIRules;
let queue = Promise.resolve();
function serialized(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}
async function syncNetworkAllowlist() {
  const stored = await browser.storage.local.get(null);
  const hosts = Object.entries(stored)
    .filter(([key, site]) => key.startsWith("site:") && site?.allowlisted)
    .map(([key]) => key.slice(5));
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.filter(rule => rule.id >= 10000).map(rule => rule.id),
    addRules: rules.networkAllowRules(hosts)
  });
}
browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "scan-result") return serialized(async () => {
    const current = await browser.storage.local.get({ blockedCount: 0, reviewCount: 0 });
    await browser.storage.local.set({
      blockedCount: current.blockedCount + Math.max(0, Number(message.blocked) || 0),
      reviewCount: current.reviewCount + Math.max(0, Number(message.review) || 0)
    });
  });
  if (message?.type !== "site-feedback") return;
  return serialized(async () => {
    const host = rules.hostname(sender.tab ? sender.url : message.url);
    const key = rules.siteKey(host);
    const stored = await browser.storage.local.get(key);
    const previous = stored[key] || rules.emptySite();
    const next = rules.updateSite(previous, message.action, message.selector);
    await browser.storage.local.set({ [key]: next });
    try {
      if (previous.allowlisted !== next.allowlisted) await syncNetworkAllowlist();
    } catch (error) {
      await browser.storage.local.set({ [key]: previous });
      await syncNetworkAllowlist().catch(() => {});
      throw error;
    }
    return next;
  });
});
browser.runtime.onInstalled.addListener(() => serialized(syncNetworkAllowlist).catch(console.error));
browser.runtime.onStartup.addListener(() => serialized(syncNetworkAllowlist).catch(console.error));
serialized(syncNetworkAllowlist).catch(console.error);
