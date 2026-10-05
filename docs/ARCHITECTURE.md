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
