"use strict";

(async () => {
  const stats = await browser.storage.local.get({ blockedCount: 0, reviewCount: 0 });
  document.getElementById("blocked").textContent = String(stats.blockedCount);
  document.getElementById("review").textContent = String(stats.reviewCount);
})();
