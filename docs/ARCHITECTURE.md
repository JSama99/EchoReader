# Architecture

## Principles

1. **Rules are pure.** Everything that decides what a reader may see or do lives in `src/domain` as plain functions: no React, Expo or I/O. These functions are unit-tested and identical on every platform.
2. **One spoiler rule.** `isReached(target, furthest)` is the single gate. The Codex, Echo cards, glyph hotspots, Cypher threads and comments all pass through `src/domain/spoilers.ts`.
3. **Content is data.** Panel and glyph geometry is normalized to 0..1 page space. Screens never hard-code positions, so new chapters need no code changes.
4. **Trust is checkable.** A POW edition is defined by its bytes, credits and ids, so any client can recompute and compare the hashes.

## Data flow

```
catalog.ts ──▶ screens ──▶ reader (Sigil/Scroll/Pages)
                  │              │ onStep(page, panel)
                  ▼              ▼
             useReader()   dispatch({ type: 'advance' })
                  ▲              │
                  │        reduce() (pure, tested)
                  └── store ◀────┘ ── persist ──▶ SQLite kv (native) / localStorage (web)
```

- `state/model.ts` holds the reducer: `advance`, `finishChapter`, `spendEmber`, `setMode`, `celebrate`, and so on. `furthest` only moves forward. `current` follows the reader.
- `state/store.tsx` is a ~60-line external store with `useSyncExternalStore`. It writes through to storage (coalesced per tick), and `migrate()` makes storage forward-compatible.
- `state/kv.ts` / `kv.web.ts` split storage by platform. Native uses `expo-sqlite/kv-store`. Web uses `localStorage`, so the QA build needs no wasm setup.

## Reader

| Mode | How progress is measured |
| --- | --- |
| Sigil | The current authored panel. `cameraForRect` fits the panel (padding, max 4×). `originCompensation` converts the math to the center-origin transforms that native and web both use. An animated four-rect mask spotlights the panel. |
| Scroll | The panel crossing the vertical midline (`panelAtLine`). Reaching the end of the strip counts as the last panel. |
| Pages | Seeing a whole page (or spread) counts as its last panel. Spreads (`spreadsFor`) turn on when the screen is landscape and ≥ 900pt wide. |

Every step calls `report()`, which:

1. Dispatches `advance`.
2. Dispatches `finishChapter` on the last panel. This earns at most one Ember per ISO week.
3. Diffs fragments crossed between the old and new furthest (`newlyFound`) and opens the Fragment moment once (`celebrate`).

Tap zones are the outer 30% of each edge; RTL swaps which edge advances. The center toggles the chrome. VoiceOver/TalkBack get increment/decrement actions for next/previous panel.

## POW verification

- **Build time:** `scripts/hash-content.mjs` writes `ledger.generated.json`. The tests re-derive every `chapterHash` with the app’s own `canonicalJson`, so the script and the app can never disagree.
- **Run time:** `services/pow-device.ts` loads each page through `expo-asset` and reads its bytes (`expo-file-system` `File.bytes()`, or `fetch` on web). It hashes them with `expo-crypto` and calls `verifyChapter`. Results are cached per session.
- **Outcomes:** `verified` shows a seal. `mismatch` shows the POW sheet with the ledger hash, the local hash and the affected pages, with a “Read anyway” option. `no-record` shows the seal as unverified.

When the live POW Ledger ships, replace `ledgerFor()` with a fetch of the signed record. Nothing else changes.

## Navigation

Expo Router (SDK 58). The tabs are Library, Discover, Codex and Cypher, with a custom Kiln tab bar. The stack screens are series, read, codex entry, thread, downloads and profile. `unlock` is a transparent modal and `fragment` is a full-screen modal. Onboarding is gated in `(tabs)/_layout.tsx`.

## Testing

- `__tests__/domain-test.ts` covers positions, the spoiler shield, fragments, access/Embers (including ISO week boundaries), POW hashing and mismatch detection, the Sigil camera (fit, inverse, hit test, center-origin compensation), tap zones, spreads and mode resolution.
- `__tests__/catalog-test.ts` is the content guardrail: rects inside pages, glyphs pointing at real entries and panels, no Codex line revealed before its entry, fair 24h windows, page order matching `editions.json`, and bundled bytes verifying against the ledger.
- `__tests__/state-test.ts` covers the reducer rules, persistence round-trip, corrupt storage recovery and no-op notifications.

Render QA: `npx expo export --platform web`, then serve `dist/` and walk the flows in a headless browser. Every v0.1 screen, the glyph tap in Sigil View, the end-of-chapter fragment trigger and tablet spreads were checked this way.

## Not built yet (by design, behind clear seams)

- **Accounts and cross-device sync:** the Profile screen says so, and the store is ready to sync because state is plain JSON.
- **Cypher posting:** the composer is visible but posting is disabled with an a11y hint, pending the service.
- **Sonic Genesis score:** the `scoreEnabled` state exists, but no audio ships until tracks exist.
- **Remote chapters and downloads:** `ledgerFor` and `pageImages` are the two seams to swap for network sources.
