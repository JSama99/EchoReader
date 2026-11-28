# EchoReader v0.2 · Phase A: repository audit and baseline

Audited commit: `20c6e13` (main). Baseline tag: **`v0.1.0`** (annotated). All v0.2 work is on branch `v0.2`.

## Baseline verification (2026-11-26)

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| Jest (3 suites) | **57 / 57 pass** |
| ESLint | pass, 0 warnings |
| Ledger freshness (`hash-content --check`) | up to date |
| Fresh `npm ci` from GitHub | pass |

## Architecture as found

- Expo SDK 58, React Native 0.88.1, React 19.3, TypeScript 6, Expo Router (file routes in `src/app`), React Compiler on.
- **Pure domain** in `src/domain` (types, position, spoilers, fragments, access, POW, sigil camera, reading mode). Well tested.
- **State**: one `ReaderState` (v1) reduced by a pure reducer and persisted as JSON in `expo-sqlite/kv-store` (native) or `localStorage` (web).
- **Content**: one bundled catalog (`src/content/catalog.ts`) plus `editions.json` → `ledger.generated.json` (SHA-256 per page).
- **Readers**: Sigil (animated camera with spotlight), Scroll, Pages (spreads on wide landscape screens). All three read `Chapter.pages` and resolve art through a static `pageImages` map.
- **Navigation**: tabs Library / Discover / Codex / Cypher; stack routes for series, reader, Codex entry, thread, downloads, profile, onboarding, unlock, fragment.

## Implementation status found

| Feature | Status at v0.1 |
|---|---|
| Sigil View (camera, spotlight, RTL tap zones, glyph hit testing) | Implemented and verified (web QA + unit tests) |
| Scroll and Pages modes, tablet spreads | Implemented and verified |
| Echo Layer glyphs → Codex | Implemented and verified |
| Spoiler Shield (Codex, Echo cards, Cypher folding, Discover search) | Implemented and verified |
| Nine Fragments (1 of 9 placed) | Implemented and verified |
| POW page-level SHA-256 verification | Implemented and verified (bundled pages only) |
| Embers (1 per ISO week of finishing a chapter) | Implemented and verified |
| Fair access: mandatory free after 24 h, Ember for early access | Implemented. **Obsolete under v0.2** |
| Cypher threads | **Sample data only**, posting disabled |
| Downloads settings ("keep next 3 chapters", "clear after reading") | **Persisted toggles with no effect.** Mock presented as real |
| Accounts, sync, purchases, remote content | Not implemented |
| Personal imports (PDF, CBZ, images) | Not implemented |

## Technical debt and risks

1. **Access rule is hard-coded**: every chapter has `freeAt ≤ publishedAt + 24h`, enforced by a catalog test. That conflicts directly with v0.2 §7.
2. **The reader is coupled to Flame Sigil**: `PageArt` resolves images only from the bundled `pageImages` map and always loads Cypher pins from the bundled catalog. There is no way to read a local file.
3. **Invented schedule copy**: the strings "New Fridays", "Arrives Friday" and "free for everyone within 24 hours" (onboarding, series, discover, unlock) are not approved publication metadata.
4. **Chapter title conflict**: the bundled Chapter 1 is titled "The Verse Begins Again", but the approved catalog (§6) says "Chapter One: Signal Lost". Chapter 2 has invented placeholder dates.
5. **Partial chapter**: Chapter 1 ships 2 pages (page 4 and the finale). This is a demonstration excerpt, not a complete master.
6. **Mock UI**: the Downloads toggles do nothing, and the Cypher shows sample comments without saying they are samples.
7. **Single state blob**: no timestamps on progress, so it can't be merged across devices.
8. **No content versioning or signatures**: the ledger proves file integrity only, and nothing distinguishes the issuer.
9. **No reduced-motion handling** in Sigil View. No manual panel controls besides tap zones and accessibility actions.
10. **Catalog exports static arrays** (`chapters`, `series`), so remote content cannot be merged at runtime.

## Plan (phases B–G) based on the above

- **B. Commercial domain:** availability, access policy, editions, entitlements, collectibles, transactions and rewards as separate pure modules. Replace the 24 h rule; migrate state v1 to v2.
- **C. Free reader:** a generic publication and capability model. Secure CBZ, image and PDF import. A personal library. Reader controls: fit modes, zoom, light reading, reduced motion, panel buttons, bookmarks, history.
- **D. Publication infrastructure:** manifest v1 with versioning, integrity and ed25519 signatures. Build the bundled catalog from a signed manifest. A remote source interface. The approved Flame Sigil catalog.
- **E. Identity and commerce:** guest identity, a sandbox commerce provider, a Supabase schema with RLS tested in PGlite, and edge-function access logic.
- **F. Vault:** a Vault tab with trust labels, Ember ledger, achievements, fragments and verification records. New navigation.
- **G. QA:** full test suite, web export, browser QA and deliverable docs.
