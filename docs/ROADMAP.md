# Roadmap

## v0.1.0

- DNR blocking
- DOM heuristic detector
- Dynamic-page rescans
- Local counters

## v0.2.0 (implemented)

- User "block this" / "not an ad" feedback (popup and touch picker)
- Per-site allowlist
- Persistent selector rules
- False-positive selectors and counts stored locally only
- jsdom regression suite and GitHub Actions (Safari device QA remains manual)

## v0.3.0

- Core ML compact classifier for medium-confidence candidates
- Feature-vector test corpus
- Performance budget tests for iPhone 12 mini

## v0.4.0

- Optional LLM fallback for unknown candidates
- Native-app/Keychain or self-hosted provider boundary
- LLM-generated minimal CSS selector with validation
- Privacy-preserving feature redaction

## v1.0.0

- Stable hybrid detector
- Importable community rulesets
- Rule rollback and per-site diagnostics
- App Store/TestFlight release workflow
