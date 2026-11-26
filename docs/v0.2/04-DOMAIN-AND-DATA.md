# Domain and data model

## On device: `ReaderState` v2

Persisted as one JSON document under `echoreader.state.v1` (`expo-sqlite/kv-store`; web: `localStorage`). Pure reducer in `src/state/model.ts`.

| Field | Purpose |
|---|---|
| `furthest`, `current`, `currentAt` | Progress per series or imported comic (`local:<id>`). `furthest` drives the Spoiler Shield; `currentAt` enables last-writer-wins sync |
| `finishedChapterIds`, `celebratedFragmentIds`, `discoveredGlyphIds` | Completion and discovery, each recorded once |
| `globalMode`, `seriesModes`, `transition`, `motion`, `readerTheme`, `fit`, `echoEnabled` | Reading preferences |
| `library`, `collections`, `bookmarks`, `history`, `readingDays`, `favorites`, `following`, `notifySeries` | Library |
| `rewards` | Ember event log and redemptions |
| `commerce` | Transactions, entitlements, collectibles |
| `achievements` | Unlocked achievement ids with timestamps |
| `analyticsConsent` | Privacy choice (default false) |

**Migration v1 → v2** (`migrateV1`): progress, modes and onboarding carry over. The Ember balance becomes a `legacy:v1-balance` event; each early-access unlock is refunded. Rewarded ISO weeks become zero-value markers, so the one-per-week rule holds in the migration week. The no-op download toggles are dropped. Unknown versions reset to a valid initial state.

**Imported page files:** native, `Documents/library/<uuid>/page-0001.jpg…`; web, IndexedDB `echoreader-library/pages` keyed `<uuid>/<file>`. Removing a comic deletes its files and every reference (progress, bookmarks, history, favorites, collections).

## Publication model

`content-src/*.json` → signed manifest (see `06-MANIFEST-SPEC.md`) → `Series`, `Chapter`, `AccessPolicy`, `Availability`, `Edition` via `src/content/catalog.ts`. `Chapter.contentStatus` (`complete · excerpt · awaiting-master`) states plainly what exists.

## Backend (Supabase, designed and tested, not deployed)

Migration: `supabase/migrations/20261126000000_echoreader_init.sql`.

| Table | Owner can | Written by |
|---|---|---|
| `profiles` | read/write own | reader |
| `publishers`, `publications`, `editions`, `promotions` | read (drafts hidden) | publisher tooling (service role) |
| `reading_progress` | read/write own; `local:*` keys rejected | reader |
| `purchase_transactions` | read own | service role, after receipt verification |
| `entitlements` | read own | service role |
| `collectibles` | read own | service role; `allocate_serial()` enforces supply |
| `reward_rules` | read | publisher |
| `reward_events` | read own | `award_reward(rule, key)` only: amount from rule, idempotent, capped |
| `community_posts`, `community_reports` | read visible posts | **nobody** (no insert policy until moderation exists) |

Deleting an `auth.users` row cascades to everything the account owns (tested).

## Identity and sync (designed, not connected)

- Guest mode is the default and is complete on its own.
- Accounts: Supabase Auth (Sign in with Apple, Google, email). Required by App Store guideline 4.8 if any third-party login is offered, Sign in with Apple must be one of them.
- Sync rules, already supported by the data: progress takes max(`furthest`) and latest `currentAt`; rewards merge by union of event ids (`mergeRewards`, tested); entitlements come from the server only.
- Account deletion in the app must call a backend deletion endpoint (guideline 5.1.1(v)). Local erase is implemented now.
