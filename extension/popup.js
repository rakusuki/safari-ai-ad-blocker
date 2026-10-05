"use strict";
(async () => {
  const status = document.getElementById("status");
  const controls = ["allow-site", "pick", "reset", "refresh"].map(id => document.getElementById(id));
  let tab;
  let state;
  async function run(task) {
    controls.forEach(button => { button.disabled = true; });
    try { await task(); } catch (error) { status.textContent = error.message; }
    finally {
      controls.forEach(button => { button.disabled = !tab; });
      if (state?.site.allowlisted) document.getElementById("pick").disabled = true;
    }
  }
  function render() {
    document.getElementById("allow-site").textContent = state.site.allowlisted ? "このサイトのブロックを有効化" : "このサイトを許可";
    document.getElementById("pick").disabled = state.site.allowlisted;
    const items = document.getElementById("items"); items.replaceChildren();
    for (const item of state.items) {
      const row = document.createElement("li");
      const label = document.createElement("span"); label.textContent = (item.blocked ? "非表示：" : "候補：") + item.label;
      row.append(label);
      for (const [action, text] of [["allow", "広告ではない"], ...(!item.blocked ? [["block", "ブロック"]] : [])]) {
        const button = document.createElement("button"); button.textContent = text;
        button.addEventListener("click", () => run(async () => {
          state = await browser.tabs.sendMessage(tab.id, { type: "element-feedback", id: item.id, action }); render();
          status.textContent = "ルールを端末内に保存しました。";
        })); row.append(button);
      }
      items.append(row);
    }
  }
  async function refresh() { state = await browser.tabs.sendMessage(tab.id, { type: "page-state" }); render(); }
  document.getElementById("refresh").addEventListener("click", () => run(refresh));
  document.getElementById("allow-site").addEventListener("click", () => run(async () => {
    await browser.runtime.sendMessage({ type: "site-feedback", url: tab.url, action: state.site.allowlisted ? "enable-site" : "allow-site" });
    await refresh(); status.textContent = "保存しました。通信ルールの反映にはページを再読み込みしてください。";
  }));
  document.getElementById("reset").addEventListener("click", () => run(async () => {
    if (!window.confirm("このサイトの手動ブロック・許可・誤検知件数を削除しますか？")) return;
    await browser.runtime.sendMessage({ type: "site-feedback", url: tab.url, action: "reset-site" });
    await refresh(); status.textContent = "削除しました。ページを再読み込みしてください。";
  }));
  document.getElementById("pick").addEventListener("click", () => run(async () => {
    await browser.tabs.sendMessage(tab.id, { type: "pick-element" }); window.close();
  }));
  await run(async () => {
    const stats = await browser.storage.local.get({ blockedCount: 0, reviewCount: 0 });
    document.getElementById("blocked").textContent = String(stats.blockedCount);
    document.getElementById("review").textContent = String(stats.reviewCount);
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    document.getElementById("host").textContent = globalThis.SafariAIRules.hostname(active.url);
    await browser.tabs.sendMessage(active.id, { type: "page-state" });
    tab = active; await refresh();
  });
})();
