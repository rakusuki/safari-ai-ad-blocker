(() => {
  "use strict";

  const STRONG_HINTS = [
    /(^|[-_])(ad|ads|advert|advertisement|sponsor|sponsored|promo|promotion)([-_]|$)/i,
    /data-ad/i,
    /ad-slot/i,
    /ad-container/i,
    /sponsored/i
  ];

  const WEAK_TEXT_HINTS = [
    /^ad$/i,
    /^広告$/,
    /^PR$/i,
    /sponsored/i,
    /promoted/i
  ];

  const AD_HOST_HINTS = [
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adservice.google.com",
    "taboola.com",
    "outbrain.com"
  ];

  function safeText(element) {
    return (element.innerText || element.textContent || "").trim().slice(0, 300);
  }

  function joinedAttributes(element) {
    const attrs = Array.from(element.attributes || [])
      .filter(attribute => !attribute.name.startsWith("data-safari-ai-ad-"))
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(" ");
    return `${element.id || ""} ${element.className || ""} ${attrs}`;
  }

  function containsAdHost(element) {
    const urls = [];
    if (element.src) urls.push(element.src);
    if (element.href) urls.push(element.href);
    element.querySelectorAll?.("iframe[src], img[src], a[href]").forEach((node) => {
      urls.push(node.src || node.href || "");
    });
    return urls.some((url) => AD_HOST_HINTS.some((host) => url.includes(host)));
  }

  function geometryScore(element) {
    const rect = element.getBoundingClientRect();
    const commonAdSizes = [
      [300, 250], [320, 50], [320, 100], [336, 280],
      [728, 90], [970, 250], [160, 600], [300, 600]
    ];
    return commonAdSizes.some(([w, h]) =>
      Math.abs(rect.width - w) <= 20 && Math.abs(rect.height - h) <= 20
    ) ? 0.2 : 0;
  }

  function scoreElement(element) {
    if (!(element instanceof HTMLElement)) return 0;
    if (["HTML", "BODY", "MAIN", "ARTICLE", "NAV", "HEADER", "FOOTER"].includes(element.tagName)) return 0;

    let score = 0;
    const attributes = joinedAttributes(element);
    const text = safeText(element);

    if (STRONG_HINTS.some((pattern) => pattern.test(attributes))) score += 0.55;
    if (WEAK_TEXT_HINTS.some((pattern) => pattern.test(text))) score += 0.25;
    if (containsAdHost(element)) score += 0.55;
    if (element.tagName === "IFRAME") score += 0.1;
    score += geometryScore(element);

    const style = getComputedStyle(element);
    if (style.position === "fixed" || style.position === "sticky") score += 0.05;

    return Math.min(score, 1);
  }

  function candidateElements(root = document) {
    const selector = [
      "iframe", "aside", "section", "div",
      "[id*='ad' i]", "[class*='ad' i]",
      "[id*='sponsor' i]", "[class*='sponsor' i]",
      "[data-ad]", "[data-ad-slot]"
    ].join(",");
    return Array.from(root.querySelectorAll(selector));
  }

  window.SafariAIAdDetector = {
    scoreElement,
    candidateElements
  };
})();
