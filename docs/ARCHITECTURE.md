# Architecture

## Goal

Run acceptably on iPhone 12 mini while keeping page load latency, memory use, battery use, and privacy impact low.

## Pipeline

1. Safari Declarative Net Request blocks known ad-network requests before page rendering.
2. A content script inspects likely ad containers after the page becomes idle.
3. `detector.js` calculates a confidence score from DOM attributes, text, URL hosts, element geometry, and positioning.
4. High-confidence elements are hidden locally.
5. Medium-confidence elements are marked as candidates but are not hidden.
6. Future ML/LLM layers can consume only candidate features rather than the full page.

## Why LLM is not called for every element

A network LLM call for every DOM candidate would increase latency, battery use, data transfer, cost, and privacy exposure. The intended design is a cascade:

`DNR -> heuristic detector -> compact ML -> optional LLM fallback -> durable rule`

## LLM integration boundary

Never embed an LLM API secret in the Safari extension bundle. A future provider should use one of:

- a native iOS companion app storing credentials in Keychain and brokering requests;
- a self-hosted authenticated backend;
- an on-device Core ML model when the model size/performance is appropriate.

Only compact candidate features should be sent, not complete browsing history or full page content by default.


## v0.2.0 local feedback layer

`rules.js` defines site state and exact-host DNR allow rules. Each `site:<hostname>` key stores allowlisted, block selectors, allow selectors, and falsePositives count. No page text, feature vectors, URL paths, timestamps, or remote telemetry are stored.

The background service worker serializes mutations so multiple tabs cannot lose rules or counters. Site allowlist changes rebuild priority-100 main-frame allowAllRequests dynamic rules; DNR failure rolls back the local preference and attempts reconciliation. Startup also reconciles stored preferences.

The content script loads rules before its first scan and watches local storage changes. Site allowlist and element allow rules take precedence over manual and automatic hiding. A permitted descendant also protects its ancestor to prevent indirect hiding. Original inline display and priority are held in memory and restored. Manual selectors apply to ordinary elements outside heuristic candidates as well. Mutation scans are debounced by 350 ms; repeated scans do not recount unchanged hidden/review elements.

Popup feedback references ephemeral in-memory element IDs. Page labels use textContent, never injected HTML. The picker saves a unique escaped ID or structural selector after confirmation. IDs and DOM paths can become stale when a site changes. Frame contents and shadow-root contents are outside the current DOM traversal.

The v0.2.0 runtime uses no network ML/LLM calls. The provider ideas above are future work.
