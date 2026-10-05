(() => {
  "use strict";

  const detector = window.SafariAIAdDetector;
  if (!detector) return;

  const HIDE_THRESHOLD = 0.85;
  const REVIEW_THRESHOLD = 0.65;
  const hidden = new WeakSet();

  function hideElement(element, score) {
    if (hidden.has(element)) return;
    hidden.add(element);
    element.dataset.safariAiAdBlocked = "true";
    element.dataset.safariAiAdScore = score.toFixed(2);
    element.style.setProperty("display", "none", "important");
  }

  function scan(root = document) {
    let blocked = 0;
    let review = 0;

    for (const element of detector.candidateElements(root)) {
      const score = detector.scoreElement(element);
      if (score >= HIDE_THRESHOLD) {
        hideElement(element, score);
        blocked += 1;
      } else if (score >= REVIEW_THRESHOLD) {
        element.dataset.safariAiAdCandidate = score.toFixed(2);
        review += 1;
      }
    }

    if (blocked || review) {
      browser.runtime.sendMessage({ type: "scan-result", blocked, review }).catch(() => {});
    }
  }

  scan();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      scan();
    }, 350);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
