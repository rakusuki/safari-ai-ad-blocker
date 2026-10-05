# Validation

## Automated

Use Node.js 22 or 24, then `npm ci --ignore-scripts`, `npm run check`, and `npm test`.
The suite runs the real detector, content script, rules and service worker against jsdom and mocked browser APIs. It covers heuristic thresholds, rescans, display restoration, selector persistence, site isolation, ancestor/descendant protection, touch/click picker confirmation, cancellation, site allowlist, exact-host DNR construction, startup reconciliation, failed saves, DNR rollback, concurrent writes and dynamic insertion. Tests do not make external page requests.

## Safari / iPhone 12 mini manual QA

1. Regenerate the Xcode project with `scripts/bootstrap_xcode.sh` (it copies extension resources; an existing project needs resource updates), sign and install. Target iOS 15.4 or later; confirm Safari permissions.
2. Open a local test page with a `div#ad-slot`, text `Sponsored`, width 300px, height 250px and original inline `display:flex!important`. Verify automatic hiding. A `div#ad-review` containing only `Sponsored` must stay visible as a review candidate, including after dynamic insertion and repeated scans.
3. Tap “広告ではない” for the hidden element. Confirm original layout is restored, and refreshing or navigating to another path on the same host does not hide it. The same element on a different hostname should still be detected.
4. Use “要素を選んでブロック” on an ordinary element. Confirm, refresh, and verify persistent hiding. Try cancel, Escape on a keyboard, and selecting main/body; no rule should be saved.
5. Allow the site and reload. Confirm both DOM hiding and base-rule ad-network requests stop being blocked. Confirm an unrelated hostname and a subdomain still block. Enable blocking again and reload.
6. Delete site rules, reload and verify automatic detection resumes and manual rules are gone.
7. Test two tabs changing preferences concurrently and Safari relaunch. Verify local rules and network exceptions survive.
8. Inspect storage and network activity: no feedback or page data is sent remotely. The extension stores hostname, selectors, counts and a boolean only.

Automated mocks do not prove Safari DNR, popup lifetime, Xcode packaging, touch behavior or real-device performance. Network-blocked resources require a reload after allowing a site.
