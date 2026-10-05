(() => {
  "use strict";
  const emptySite = () => ({ allowlisted: false, block: [], allow: [], falsePositives: 0 });
  function hostname(url) {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("HTTP(S)ページを開いてください。");
    return parsed.hostname;
  }
  function siteKey(host) { return "site:" + host; }
  function updateSite(current, action, selector) {
    const next = { ...emptySite(), ...current };
    next.block = [...next.block];
    next.allow = [...next.allow];
    if (action === "allow-site") next.allowlisted = true;
    else if (action === "enable-site") next.allowlisted = false;
    else if (action === "reset-site") return emptySite();
    else {
      if (typeof selector !== "string" || !selector || selector.length > 2048) throw new Error("Invalid selector");
      if (action === "block") {
        next.allow = next.allow.filter(s => s !== selector);
        if (!next.block.includes(selector)) next.block.push(selector);
      } else if (action === "allow") {
        next.block = next.block.filter(s => s !== selector);
        if (!next.allow.includes(selector)) {
          next.allow.push(selector);
          next.falsePositives += 1;
        }
      } else throw new Error("Unknown action");
    }
    return next;
  }
  function networkAllowRules(hosts) {
    return [...hosts].sort().map((host, index) => ({
      id: 10000 + index, priority: 100, action: { type: "allowAllRequests" },
      condition: {
        regexFilter: "^https?://" + host.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&") + "(?::[0-9]+)?/",
        resourceTypes: ["main_frame"]
      }
    }));
  }
  globalThis.SafariAIRules = { emptySite, hostname, siteKey, updateSite, networkAllowRules };
})();
