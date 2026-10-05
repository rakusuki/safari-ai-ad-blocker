# Changelog

## 0.2.0 - 2026-10-05

- Local-only, per-host persistent block and not-an-ad selector feedback.
- Restore original display and priority; protect allowed elements and their ancestors/descendants.
- Touch-friendly element picker, candidate review and rule reset in popup.
- Site allowlist for both DOM and DNR, with network-update failure rollback.
- Serialized feedback/counter writes and dynamic-rule startup reconciliation.
- Keep 0.85/0.65 thresholds; exclude extension metadata from detector inputs and avoid duplicate scan counts.
- Regression tests, runtime checks, and Node.js 22/24 GitHub Actions.

## 0.1.0 - 2026-10-05

- Initial Safari Web Extension MVP.
- Declarative Net Request rules for common ad networks.
- Lightweight DOM ad scoring and automatic hiding.
- MutationObserver support for dynamically inserted ads.
- Local statistics popup.
- iOS-only Xcode bootstrap script.
