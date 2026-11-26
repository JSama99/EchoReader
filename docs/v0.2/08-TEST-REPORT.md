# Test execution report (2026-11-26)

## Automated

| Suite | Tests | Result | Covers |
|---|---|---|---|
| `domain-test` | 32 | pass | positions, spoilers, fragments, POW, Sigil camera, reading mode, time keys |
| `state-test` | 15 | pass | reducer, v1→v2 migration, bookmarks, history, imports, collections, purchases, persistence |
| `commerce-test` | 24 | pass | all access states, trust modes, ledger idempotency, transitions, refunds, serials, trust labels, Embers |
| `catalog-test` | 20 | pass | approved catalog, prices, geometry, manifest validation, signatures, install gate, paid-asset rule, POW parity |
| `import-test` | 15 | pass | sniffing, header sizes, CBZ ordering/metadata, traversal, bombs, lying headers, CRC, limits, encryption, RAR, images |
| `platform-test` | 10 | pass | core reader without metadata, capabilities, fit modes, shelves, analytics privacy, achievements |
| `server-access-test` | 22 | pass | edge-function authorization equals app access in 11 cases × 2 trust modes |
| **Jest total** | **138** (v0.1 tests for the 24 h rule were replaced by the new access tests) | **pass** | |
| `scripts/test-db.mjs` (PostgreSQL via PGlite) | 9 | pass | RLS isolation, no self-granting, drafts hidden, private progress, no `local:` sync, posting disabled, cascade delete, server Embers, serial supply, verified-collectible constraint |
| TypeScript `--noEmit` | n/a | pass | |
| ESLint (expo config, React Compiler rules) | n/a | 0 errors, 0 warnings | |
| Manifest freshness | n/a | up to date | |
| expo-doctor | 18/20 | 2 need network (Expo API, RN Directory); same on baseline | |

Baseline before changes: 57/57 (tag `v0.1.0`).

## Browser QA (web export, Chrome, 430×900 @2x and 1366×1024)

24/24 checks pass on the sandbox build with **zero console errors**: onboarding copy, approved chapter list, no invented schedule copy, five tabs, CBZ import with ComicInfo, path-traversal archive refused, single-image import, detail page, imported pages rendering from IndexedDB, no Sigil/Echo features for imports, bookmark toggle, light theme and fit-width, bookmarks and collections in the Library, Chapter One free in Sigil View, tap advancing to panel 2, three editions at configured prices, minting disclosure, no purchase before pages exist, Vault sections, integrity-is-not-ownership notice, guest profile, persistence across reload, tablet layout.

The production build (no sandbox) passes the same checks, except that the editions button reads "Purchases open soon" as intended. The Vault shows "Signed with a development key".

Defect found and fixed during QA: the catalog reader selected a freshly built object from the store, causing an update loop (React #185). It now uses the `useAccess` hook, which selects stable store slices.

## Not executed (and why)

| Area | Reason |
|---|---|
| iOS / Android device runs | No simulator or device in this environment; requires a development build (`eas build --profile development`) |
| PDF import (`modules/echo-pdf`) | Native Swift/Kotlin; compiles only in a device build |
| Pinch-to-zoom | Needs multi-touch; double-tap zoom path and clamping are in the same component |
| VoiceOver / TalkBack | Needs devices; labels, roles, live regions and the Reduce Motion path are implemented |
| Sandbox purchase through the UI | No paid chapter has pages yet, so the buy button is correctly disabled. Ledger, refunds and restore are covered by unit tests; the reducer path by `state-test` |
| Edge function and Supabase deployment | No project exists; schema and authorization logic tested locally |

---

# Device compatibility

| Target | Status |
|---|---|
| iPhone (iOS 16.4+, SDK 58 minimum) | Expected to work; layouts are responsive and tested at phone width on web. **Unverified on device.** |
| iPad | Spreads in landscape (≥ 900 pt wide), fit modes, tablet home verified on web at 1366×1024. **Unverified on device.** |
| Android phones and tablets | Same code paths; `PdfRenderer` requires API 21+, which SDK 58 exceeds. **Unverified on device.** |
| Web (QA build) | Verified in Chrome. PDF import is unavailable on web and says so. |
| Orientation | Readers re-measure on layout; Sigil camera recomputes. Verified on web resize. |
| Offline | Bundled chapter, imports, progress and all state work offline (no network calls in the app). |

---

# Known issues and blockers

| # | Issue | Type |
|---|---|---|
| 1 | No approved masters for the Prologue or Chapters Two to Six. Chapter One is a 2-page excerpt | Blocked on content |
| 2 | Real purchases need App Store Connect and Play Console products, IAP integration and server receipt verification | Blocked on store accounts |
| 3 | Accounts, sync and remote content need a Supabase project and keys | Blocked on backend provisioning |
| 4 | Production manifest-signing key not created (`npm run keygen`) | Owner action |
| 5 | Blockchain minting, wallets and transfers are not built (by design for v0.2) | Deferred |
| 6 | Legendary edition supply not set | Owner decision |
| 7 | PDF module and pinch zoom unverified on device | Needs device build |
| 8 | CBR (RAR) not supported: no permissively licensed, maintained pure-JS RAR decoder. `.cbr` files that are actually ZIPs import fine | Licensing |
| 9 | Ember redemption catalog is empty (no rewards offered yet) | Content |
| 10 | Light reading background darkens the reader chrome only; the rest of the app stays dark | Design follow-up |
