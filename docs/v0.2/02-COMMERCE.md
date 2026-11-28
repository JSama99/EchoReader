# Commercial access model

Code: `src/domain/commerce/` · tests: `__tests__/commerce-test.ts`, `__tests__/server-access-test.ts`, `scripts/test-db.mjs`

## The v0.1 rule is gone

v0.1 made every chapter free for everyone within 24 hours, enforced by a catalog test. That rule and its test are removed. A paid chapter stays paid until the publisher changes its policy or runs a promotion. A test asserts that a paid chapter is still paid five years later.

## Three separate models

| Model | Answers | Written by |
|---|---|---|
| `Availability` | Has the publisher released it? `draft · scheduled · published · archived · unavailable` | Manifest |
| `Entitlement` | May this reader read it? Source `purchase · subscription · promotion · reward · grant`; verification `store-verified · server-verified · sandbox · local` | Purchase ledger / backend |
| `Collectible` | Does the reader own a numbered edition? `demo · reserved · minted-unverified · verified` | Purchase ledger / backend / chain verifier |

**Collectibles never grant reading.** An edition's reading right comes from its purchase entitlement. This matches App Store Review Guideline 3.1.1, which lets apps sell NFTs through in-app purchase but does not allow NFT ownership to unlock content or features.

## Access states

`resolveAccess()` returns one of ten states:

| State | Readable pages | When |
|---|---|---|
| `free` | all | policy `base: free` |
| `promotional` | all | active promotion window, or an Ember unlock the publisher allowed |
| `purchased` | all | active purchase entitlement (standard edition) |
| `collectible` | all | active purchase entitlement for a collector or legendary edition |
| `subscription` | all | active subscription entitlement |
| `preview` | first N | paid, `previewPages > 0`, no entitlement |
| `paid` | none | paid, no preview, no entitlement |
| `scheduled` | none | `scheduled` with `releaseAt` in the future |
| `unpublished` | none | `draft` |
| `unavailable` | none | withdrawn, unknown, or archived and not owned |

Precedence: availability → entitlement (purchase > subscription > promotion > reward > grant) → policy. Archived publications stay readable for readers who own them.

**Trust:** production builds honor only `store-verified` and `server-verified` entitlements. Sandbox builds also honor `sandbox`. A sandbox purchase can never unlock content in production, and the server enforces the same rule (`acceptSandbox: false` in production).

## Editions (configurable per chapter in the manifest)

| Edition | Price | Collectible | Includes reading |
|---|---|---|---|
| Standard Digital Edition | $4.99 | none | yes |
| NFT Collector Edition | $9.99 | numbered, open supply, ERC-721 intended | yes |
| Legendary Collector Edition | $19.99 | numbered, supply set by publisher (currently unset) | yes |

Prices are integer minor units with an ISO currency. Benefits are publisher-authored text. `includesReading: true` is required by the validator, so a premium edition can never omit the comic. Store SKUs are pre-assigned (for example `com.talonsight.echoreader.fs2.standard`), but the store products don't exist yet.

## Free Explorer (current configuration)

- Free: Prologue (6 pages) and Chapter One: Signal Lost (14 pages), both complete and published.
- Chapters Two to Six: paid, 3-page preview, three editions. They are `draft` until masters are approved.
- Embers do not unlock paid chapters (`emberUnlockCost` absent on every chapter).
- Free for everyone, always: imports, the reader, Codex, Spoiler Shield, discovery, Embers.

## Purchases

`applyTransaction()` is idempotent and keyed by the store transaction id. Status moves only forward (`pending → completed | failed | cancelled`, `completed → refunded`). Completion grants an entitlement and, for collector tiers, a **reserved** collectible with no serial. Refunds revoke the entitlement and release an unminted reservation. Restore replays store transactions through the same function. Serial allocation is server-side and supply-bounded (`allocate_serial`, tested in Postgres).

**Providers:** `sandbox` (local test purchases, labeled everywhere, flagged synthetic in analytics) and `none` (the UI says "Purchases open soon"). The real provider must use **Apple In-App Purchase** and **Google Play Billing**: digital comics are content consumed in the app, so both stores require their billing systems. Receipts are verified server-side (App Store Server API / Google Play Developer API) before an entitlement is written.

## Embers

Non-transferable, off-chain, not money. Balance = sum of an append-only event log minus redemptions. Each award has an idempotency key (`rule:key`). Rules are configurable:

| Rule | Amount | Limits |
|---|---|---|
| chapter-complete | 1 | once per chapter, 1 per ISO week (v0.1 behavior preserved) |
| glyph-discovered | 1 | once per glyph, 3 per day |
| reading-streak (7 days) | 2 | once per streak |
| collection-complete | 3 | once per collection |
| achievement | 1 | once per achievement |
| lore-challenge, community | n/a | defined, disabled until those features exist |

Imported comics never earn Embers. Redemption works for publisher-offered items only; none are offered yet. v1 balances migrate exactly, and Embers spent on v0.1 early access are refunded, because that model no longer exists.
