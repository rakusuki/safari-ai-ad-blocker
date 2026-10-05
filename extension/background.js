"use strict";

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type !== "scan-result") return;

  const current = await browser.storage.local.get({
    blockedCount: 0,
    reviewCount: 0
  });

  await browser.storage.local.set({
    blockedCount: current.blockedCount + (message.blocked || 0),
    reviewCount: current.reviewCount + (message.review || 0)
  });
});
