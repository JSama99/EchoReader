# Publication manifest specification: `echoreader.manifest/1`

One manifest describes one series and its publications. Validator: `validateManifest()` in `src/domain/manifest.ts` (strict; unknown shapes never reach the reader). Builder: `scripts/build-manifests.mjs`.

## Top level

| Field | Type | Rules |
|---|---|---|
| `schema` | `"echoreader.manifest/1"` | required |
| `manifestId` | string | stable id, e.g. `talonsight/flame-sigil` |
| `version` | int ≥ 1 | monotonic; clients never replace a manifest with a lower or equal version |
| `issuedAt` | ISO-8601 | |
| `publisher` | `{ id, name }` | must match the signing key's publisher |
| `series` | `{ id, title, tagline, direction: ltr|rtl, defaultMode: sigil|scroll|pages, capabilities[], status: live|coming-soon, releaseLabel? }` | |
| `publications` | array | unique `publicationId` and `chapterNumber` |
| `signature` | `{ alg: "ed25519", keyId, value: 128 hex }` | over `canonicalJson(manifest without signature)` |

## Publication

| Field | Notes |
|---|---|
| `publicationId` | lowercase id; also the edition and ledger key |
| `chapterNumber` | 0 = prologue |
| `label`, `title`, `description?` | approved metadata only |
| `descriptionSafeAfter?`, `spoilerLevel` | `none · mild · major`; descriptions can be held back until a position |
| `contentStatus` | `complete · excerpt · awaiting-master` (`awaiting-master` must list no pages) |
| `direction`, `capabilities[]` | |
| `availability` | `{ status: draft|scheduled|published|archived|unavailable, releaseAt? (required if scheduled), publishedAt? }` |
| `access` | `{ base: free|paid, previewPages, promotions[], subscriptionEligible, emberUnlockCost? }` (a paid publication needs an edition on sale) |
| `editions[]` | `{ id, tier, title, price{amountMinor,currency}, productIds{ios,android,web}, benefits[], includesReading: true, collectible: null | {kind:"numbered", supply, standard}, onSale }` |
| `contentVersion` | bumped when page bytes or credits change |
| `credits[]` | part of the publication hash |
| `pageCount` | ≥ listed pages |
| `pages[]` | `{ id, label, width, height, sha256, bytes, asset?, panels[], glyphs[] }` |
| `integrity` | `{ algorithm: "sha256-canonical-v1", publicationHash }` (hash required iff pages exist) |
| `chainRefs?` | reserved for future on-chain edition records; informational only |

### Assets and paid content

`asset` is where a page can be fetched **without authorization**: `bundled:<pageId>` (inside the app) or a public URL. The validator rejects:

- any `asset` on a page of an unpublished (`draft`, `archived`, `unavailable`) publication;
- any `asset` on a paid publication's page beyond `previewPages`.

Every other page is fetched through the content service: `POST /functions/v1/content-access { publicationId }` with the reader's token returns short-lived signed URLs, but only for pages the server-side `authorizePages()` allows. A parity test keeps that function identical to the app's `resolveAccess()`.

## Integrity, issuer and what they do not prove

- `pages[].sha256`: the device hashes the bytes it will render and compares them (POW seal). A mismatch names the pages and never blocks reading.
- `publicationHash = sha256(canonicalJson({ chapterId, credits, pageHashes, seriesId }))`. This is unchanged from the v0.1 ledger: Chapter One's hash is still `2c8f81b5…ab4a`.
- `signature`: proves the manifest was issued by a trusted key holder and not altered.

None of these prove copyright ownership, authorship or blockchain ownership. The UI says so wherever verification is shown.

## Keys

`src/content/trust.ts` lists trusted issuers. `talonsight-dev-1` is a **public development key** (committed in `scripts/dev-keys/`), trusted only in development builds; release builds show "Signed with a development key". Bundled manifests may use it, but remote manifests must carry a production-trusted signature. Create a production key with `npm run keygen -- <path outside repo>`, add its public key to `trust.ts` with `environment: 'production'`, and sign with `npm run build-manifests -- --key <path> --key-id <id>`.

## Example (abridged)

```json
{
  "schema": "echoreader.manifest/1",
  "manifestId": "talonsight/flame-sigil",
  "version": 1,
  "issuedAt": "2026-11-26T00:00:00.000Z",
  "publisher": { "id": "talonsight", "name": "TalonSight Technologies" },
  "series": { "id": "flame-sigil", "title": "Flame Sigil", "direction": "ltr", "defaultMode": "sigil", "capabilities": ["standard", "sigil", "echo", "codex", "fragments", "cypher", "verification", "collectibles"], "status": "live" },
  "publications": [
    {
      "publicationId": "flame-sigil-2", "chapterNumber": 2, "label": "Chapter Two", "title": "White Silence",
      "contentStatus": "awaiting-master", "availability": { "status": "draft" },
      "access": { "base": "paid", "previewPages": 3, "promotions": [], "subscriptionEligible": false },
      "editions": [{ "id": "fs2-standard", "tier": "standard", "price": { "amountMinor": 499, "currency": "USD" }, "includesReading": true, "collectible": null, "onSale": true }],
      "pageCount": 0, "pages": [], "integrity": { "algorithm": "sha256-canonical-v1", "publicationHash": null }
    }
  ],
  "signature": { "alg": "ed25519", "keyId": "talonsight-dev-1", "value": "…" }
}
```
