(() => {
  "use strict";
  const detector = window.SafariAIAdDetector;
  const rules = globalThis.SafariAIRules;
  if (!detector || !rules) return;
  const key = rules.siteKey(location.hostname);
  const hidden = new Map();
  const candidates = new Set();
  const ids = new Map();
  let nextId = 1;
  let site = rules.emptySite();
  let ready = false;
  let picking = false;
  let notice;

  function matches(element, selectors) {
    return selectors.some(selector => {
      try { return element.matches(selector); } catch { return false; }
    });
  }
  function allowed(element) {
    // Do not hide a parent of an explicitly restored element either.
    return site.allow.some(selector => {
      try { return element.closest(selector) || element.querySelector(selector); } catch { return false; }
    });
  }
  function selectorFor(element) {
    if (!(element instanceof HTMLElement) || ["HTML", "BODY", "MAIN", "ARTICLE", "NAV", "HEADER", "FOOTER"].includes(element.tagName)) {
      throw new Error("ページ全体や主要領域は選択できません。小さい要素を選んでください。");
    }
    const parts = [];
    let node = element;
    while (node && node !== document.documentElement) {
      if (node.id) {
        const id = "#" + CSS.escape(node.id);
        if (document.querySelectorAll(id).length === 1) { parts.unshift(id); break; }
      }
      const tag = node.tagName.toLowerCase();
      const siblings = Array.from(node.parentElement.children).filter(child => child.tagName === node.tagName);
      parts.unshift(tag + ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")");
      node = node.parentElement;
    }
    const selector = parts.join(" > ");
    if (selector.length > 2048 || document.querySelectorAll(selector).length !== 1) throw new Error("一意のルールを作成できません。");
    return selector;
  }
  function clearMark(element) {
    delete element.dataset.safariAiAdCandidate;
    candidates.delete(element);
  }
  function restore(element) {
    const saved = hidden.get(element);
    if (saved) {
      if (saved.value) element.style.setProperty("display", saved.value, saved.priority);
      else element.style.removeProperty("display");
      hidden.delete(element);
    }
    delete element.dataset.safariAiAdBlocked;
    delete element.dataset.safariAiAdScore;
    clearMark(element);
  }
  function hide(element, score, manual) {
    clearMark(element);
    if (hidden.has(element)) return false;
    hidden.set(element, { value: element.style.getPropertyValue("display"), priority: element.style.getPropertyPriority("display"), manual });
    element.dataset.safariAiAdBlocked = "true";
    element.dataset.safariAiAdScore = String(score);
    element.style.setProperty("display", "none", "important");
    return true;
  }
  function scan() {
    if (!ready) return;
    for (const element of [...hidden.keys(), ...candidates]) {
      if (!element.isConnected) { hidden.delete(element); candidates.delete(element); continue; }
      if (site.allowlisted || allowed(element) || (hidden.get(element)?.manual && !matches(element, site.block))) restore(element);
    }
    for (const [id, element] of ids) if (!element.isConnected) ids.delete(id);
    if (site.allowlisted) return;
    let blocked = 0;
    let review = 0;
    const manual = new Set();
    for (const selector of site.block) {
      try { document.querySelectorAll(selector).forEach(element => manual.add(element)); } catch { /* Ignore stale invalid rules. */ }
    }
    for (const element of new Set([...manual, ...detector.candidateElements(document)])) {
      if (allowed(element)) { restore(element); continue; }
      if (hidden.has(element)) continue;
      const score = detector.scoreElement(element);
      if (manual.has(element) || score >= 0.85) blocked += Number(hide(element, score.toFixed(2), manual.has(element)));
      else if (score >= 0.65) {
        if (!candidates.has(element)) review += 1;
        candidates.add(element);
        element.dataset.safariAiAdCandidate = score.toFixed(2);
      } else clearMark(element);
    }
    if (blocked || review) browser.runtime.sendMessage({ type: "scan-result", blocked, review }).catch(() => {});
  }
  async function refresh() {
    const stored = await browser.storage.local.get(key);
    site = stored[key] || rules.emptySite();
    ready = true;
    scan();
  }
  async function feedback(element, action) {
    const selector = selectorFor(element);
    site = await browser.runtime.sendMessage({ type: "site-feedback", action, selector });
    if (action === "allow") restore(element);
    scan();
  }
  function list() {
    const elements = [...hidden.keys(), ...candidates].filter(element => element.isConnected);
    return elements.slice(0, 100).map(element => {
      let id = [...ids].find(([, node]) => node === element)?.[0];
      if (!id) { id = nextId++; ids.set(id, element); }
      return { id, blocked: hidden.has(element), label: element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") };
    });
  }
  function stopPicking() {
    picking = false;
    document.removeEventListener("click", pick, true);
    document.removeEventListener("keydown", escape, true);
    notice?.remove();
  }
  function escape(event) { if (event.key === "Escape") stopPicking(); }
  async function pick(event) {
    if (!picking || notice?.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const element = event.composedPath().find(node => node instanceof HTMLElement);
    stopPicking();
    try {
      selectorFor(element);
      if (window.confirm("この要素をこのサイトで継続的にブロックしますか？")) await feedback(element, "block");
    } catch (error) { window.alert(error.message); }
  }
  function startPicking() {
    stopPicking(); picking = true;
    notice = document.createElement("div");
    const shadow = notice.attachShadow({ mode: "closed" });
    const button = document.createElement("button");
    button.textContent = "ブロックする要素をタップ（ここで取消）";
    button.style.cssText = "position:fixed;top:12px;left:12px;z-index:2147483647;padding:14px;background:#123;color:white;border:2px solid white;border-radius:8px;font-size:14px";
    button.addEventListener("click", stopPicking);
    shadow.append(button); document.documentElement.append(notice);
    document.addEventListener("click", pick, true);
    document.addEventListener("keydown", escape, true);
  }
  browser.runtime.onMessage.addListener(async message => {
    if (message?.type === "page-state") { await refresh(); return { items: list(), site }; }
    if (message?.type === "pick-element") { startPicking(); return { ok: true }; }
    if (message?.type === "element-feedback") {
      const element = ids.get(message.id);
      if (!element?.isConnected) throw new Error("要素が変更されました。一覧を更新してください。");
      if (!["allow", "block"].includes(message.action)) throw new Error("Invalid action");
      await feedback(element, message.action); return { items: list(), site };
    }
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[key]) refresh().catch(console.error);
  });
  refresh().catch(console.error);
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => { scheduled = false; scan(); }, 350);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "id", "src", "href", "data-ad", "data-ad-slot"] });
})();
