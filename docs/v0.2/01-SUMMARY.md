# EchoReader v0.2: Commercial Foundation · engineering summary

Branch `v0.2`, based on baseline tag `v0.1.0`. 101 files changed (+9,011 / −1,287): 58 added, 35 modified, 2 moved, 6 removed.

| Document | Deliverable |
|---|---|
| [00-AUDIT.md](00-AUDIT.md) | Phase A audit and baseline |
| this file | Summary, feature classification, files, regressions, readiness, v0.3 |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Updated architecture |
| [../../README.md](../../README.md) | Updated README |
| [04-DOMAIN-AND-DATA.md](04-DOMAIN-AND-DATA.md) | Database and domain model |
| [02-COMMERCE.md](02-COMMERCE.md) | Commercial access model |
| [06-MANIFEST-SPEC.md](06-MANIFEST-SPEC.md) | Publication manifest specification |
| [07-SECURITY-PRIVACY.md](07-SECURITY-PRIVACY.md) | Security and privacy assessment |
| [08-TEST-REPORT.md](08-TEST-REPORT.md) | Test report, device compatibility, known issues and blockers |
| [../CONTENT.md](../CONTENT.md) | Content status and publishing workflow |

## What was done

1. **The reader is free and standalone.** Secure import of CBZ, images and PDF; a personal library with shelves, collections, favorites, metadata editing, bookmarks and history; reading controls (fit modes, zoom, light background, Reduce Motion, panel buttons). It works offline with no account.
2. **The core is decoupled from Flame Sigil.** Publications declare capabilities; imported comics need no metadata and never see Sigil, Echo or Cypher features.
3. **The 24-hour rule is replaced** by publisher-controlled availability, policies and editions, with entitlements and collectibles as separate models (10 access states).
4. **The catalog comes from signed, versioned manifests** with page hashes, publication hashes, edition and publisher ids, and ed25519 issuer verification. The approved Flame Sigil catalog replaces the invented v0.1 title and dates.
5. **Embers became a rule-based, idempotent, capped loyalty system.** They are non-transferable, and v1 balances migrated exactly.
6. **Vault, new navigation** (Home · Discover · Library · Vault · Profile), purchase history, privacy controls, achievements.
7. **Backend foundation**: a Supabase schema with row-level security executed and attacked in Postgres, plus server-side page authorization proven identical to the app's.

## Feature classification

| Feature | Classification |
|---|---|
| Sigil View (camera, spotlight, tap zones, panel buttons, Reduce Motion) | Implemented and verified (web) |
| Echo Layer, Spoiler Shield, Nine Fragments | Implemented and verified |
| POW page integrity, publication hash, versioned signed manifests, issuer verification | Implemented and verified |
| Signed publication records on a blockchain, future chain references | Architectural foundation only |
| CBZ, JPEG, PNG, WebP import with safety limits | Implemented and verified |
| PDF import (local Expo module, PDFKit / PdfRenderer) | Implemented but unverified (needs a device build) |
| CBR import | Not implemented (licensing; see known issues) |
| Library: collections, favorites, metadata edit, cover, remove, shelves, bookmarks, history | Implemented and verified |
| Scroll / Pages, LTR / RTL, spreads, fit page/width/height, light/dark | Implemented and verified (web) |
| Pinch-to-zoom | Implemented but unverified (multi-touch); double-tap zoom shares the code |
| Offline reading and local persistence | Implemented and verified |
| Configurable access policies (10 states), promotions, previews, archive | Implemented and verified |
| Standard / Collector / Legendary editions, configurable prices and benefits | Implemented and verified |
| Purchase ledger: idempotency, refunds, restore | Implemented and verified (unit); UI purchase path unverified because no paid chapter has pages yet |
| Real App Store / Google Play purchasing | Blocked by external dependency |
| Sandbox purchases | Implemented and verified (logic) |
| Reading entitlements separate from collectible ownership | Implemented and verified |
| Collectible trust labels, server serial allocation | Implemented and verified |
| NFT minting, wallets, transfers, marketplace | Not implemented (deferred by brief) |
| Embers: rules, caps, idempotency, merge, redemption | Implemented and verified; redemption catalog empty |
| EchoVerse Vault interface | Implemented and verified |
| Genesis / Elemental Sigils | Architectural foundation only (not issued) |
| Accounts, sync, account recovery, purchase restoration across devices | Architectural foundation only / blocked (backend not provisioned) |
| Guest mode, on-device erase, privacy preferences | Implemented and verified |
| Supabase schema + RLS | Implemented and verified (PGlite); not deployed |
| Content-access edge function | Partially implemented (logic verified; function not deployed) |
| Remote manifest install gate | Implemented and verified; content service not live |
| Authorized offline downloads of remote chapters | Architectural foundation only |
| Analytics (consent, sanitization, synthetic flag, queue) | Implemented and verified; no transport configured |
| Publisher analytics dashboard | Not implemented (foundation: event model) |
| Cypher posting, moderation, reporting | Architectural foundation only (disabled in app and database) |
| Multi-publisher data model | Architectural foundation only (publisher ids throughout) |
| Automatic panel detection | Not implemented (not claimed) |

## Files

**Added:** `src/domain/{capabilities,library,manifest,signature,rewards,analytics,achievements,fit}.ts`, `src/domain/commerce/{types,access,ledger}.ts`, `src/domain/import/{sniff,limits,comicinfo,cbz,pipeline}.ts`, `src/services/{config,importer,page-store,page-store.web,commerce,identity,analytics}.ts`, `src/state/shelves.ts`, `src/reader/zoomable.tsx`, `src/ui/local-cover.tsx`, `src/content/{lore,trust}.ts`, `src/content/manifests/flame-sigil.json`, screens `(tabs)/{library,vault,profile}`, `editions/[chapterId]`, `publication/[id]`, `modules/echo-pdf/**`, `content-src/flame-sigil.json`, `scripts/{build-manifests,keygen,test-db}.mjs`, `scripts/dev-keys/*`, `supabase/**`, tests `commerce`, `import`, `platform`, `server-access`, `docs/v0.2/*`.

**Modified:** domain types and position, catalog, state model and derived hooks, all three readers, page art, sheets, home, discover, series, reader screen, downloads, onboarding, Codex, Cypher, thread, fragment, layouts, icons, seal, tests (domain, state, catalog), README, ARCHITECTURE, CONTENT, AGENTS, LICENSE-CONTENT, package.json, tsconfig, eslint config.

**Moved:** `(tabs)/codex` → `codex/index`, `(tabs)/cypher` → `cypher`, `profile` → `(tabs)/profile`.

**Removed:** `domain/access.ts` (24 h rule), `unlock/[chapterId]`, `editions.json`, `ledger.generated.json`, `scripts/hash-content.mjs` (superseded by `build-manifests`; `npm run hash-content` still works).

## Regression analysis

| v0.1 behavior | v0.2 |
|---|---|
| Sigil View camera, spotlight, RTL taps, glyph hit testing | Unchanged code paths; unit tests unchanged and passing; verified in browser |
| Scroll, Pages, tablet spreads | Same, plus fit modes and zoom; spreads only in fit-page |
| Codex reveal and Spoiler Shield | Unchanged. `START` moved to chapter −1, so nothing is "discovered" before reading (the v0.1 Pulse entry was visible at launch) |
| Fragment I moment | Unchanged |
| POW verification of Chapter One | Same hash `2c8f81b5…ab4a`; source of truth moved from ledger JSON to the signed manifest |
| Embers: 1 per ISO week for finishing | Preserved exactly as a rule; balance migrated |
| Free-in-24 h, Ember early access | **Intentionally removed** (brief §7); spent Embers refunded on migration |
| Downloads toggles | **Intentionally removed** (they did nothing); screen now lists what is really offline |
| Cypher composer | Replaced by an explicit "sample discussion, posting opens with moderation" notice |
| Chapter 1 title "The Verse Begins Again" | **Intentionally changed** to approved "Signal Lost" |
| Tabs Library / Discover / Codex / Cypher | Now Home / Discover / Library / Vault / Profile; Codex and Cypher are reached from Home and the series |

No unintended regressions were found by the test suites or browser QA.

## Production readiness

**Not production-ready.** The free reader and Chapter One could ship to TestFlight and Play internal testing once verified on devices. A public commercial launch is blocked by:

1. On-device verification (dev builds on iPhone, iPad, Android) including the PDF module, pinch zoom and screen readers.
2. Approved chapter masters.
3. Store products, IAP / Play Billing integration and server receipt verification.
4. A Supabase project (auth, sync, content delivery) and a production signing key.
5. Privacy policy and store privacy labels matching the analytics design.

## Recommendations for v0.3

1. **Device pass first:** EAS development builds, fix anything native (PDF module, gestures), run VoiceOver and TalkBack.
2. **Commerce for real:** `expo-iap` (or `react-native-iap`) provider behind the existing `CommerceProvider` interface; a `verify-purchase` edge function using the App Store Server API and Google Play Developer API; store webhooks for refunds.
3. **Provision Supabase:** Sign in with Apple and Google, sync using the existing merge rules, server-side Ember awards, account deletion endpoint.
4. **Content service:** upload masters to private Storage, publish signed manifests remotely, authorized downloads with hash verification.
5. **Publisher tooling:** a small internal tool that edits `content-src`, previews panel rects on the art, and signs with the production key.
6. **Light theme across the app**, larger Dynamic Type support, and a reading-position slider.
7. **Collectibles (only after legal review):** define ownership rights text, pick the chain, mint on purchase with server verification, show the chain reference in the Vault.
