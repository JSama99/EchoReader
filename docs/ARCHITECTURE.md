# EchoReader architecture (v0.2)

EchoReader is one TypeScript codebase (Expo SDK 58, React Native 0.88, Expo Router) for iOS, Android and web. Every rule that matters lives in **pure, tested domain modules**. Screens render state and dispatch actions; services do device I/O.

```
src/
  domain/            pure logic, no React, no I/O (unit-tested)
    types.ts         Page, Chapter, Series, Capability, Codex, Fragment…
    capabilities.ts  which features a publication declares (Sigil, Echo, Cypher…)
    commerce/        availability, access policy, editions, entitlements,
                     transactions, collectibles (each separate)
    rewards.ts       Embers: rules, idempotent award, caps, redemption, merge
    library.ts       imported comics, collections, shelves, bookmarks
    import/          sniffing, header sizing, hardened CBZ reader, pipeline
    manifest.ts      publication manifest v1: types and strict validator
    signature.ts     ed25519 issuer verification
    pow.ts           SHA-256 page/publication integrity
    sigil.ts         Sigil View camera, tap zones, spreads
    spoilers.ts, fragments.ts, position.ts, reading-mode.ts, fit.ts,
    analytics.ts, achievements.ts
  content/           runtime catalog built from signed manifests, plus lore
  state/             ReaderState v2 reducer, persistence, derived hooks
  services/          device I/O: importer, page store, PDF, commerce,
                     identity, analytics, POW hashing, config
  reader/            Sigil / Scroll / Pages readers, zoom, sheets
  app/               Expo Router screens
  ui/, theme/        kit, icons, tokens
modules/echo-pdf/    local Expo module: PDF page rendering (PDFKit / PdfRenderer)
content-src/         editorial sources for manifests (approved metadata)
supabase/            backend schema + RLS, edge function (not deployed)
scripts/             build-manifests, keygen, test-db
```

## The reading core is publication-agnostic

The readers take a `Chapter` (pages with pixel sizes and an optional `src`) plus the publication's **capabilities**:

| Capability | Effect |
|---|---|
| `standard` | Scroll and Pages modes, fit modes, zoom, bookmarks, progress |
| `sigil` | Sigil View is offered (needs authored panels) |
| `echo` | Echo Layer glyphs render and open the Codex |
| `cypher` | Panel discussion pins render |
| `fragments` | Memory Fragment discovery runs |
| `verification` | POW seal and integrity check |

Imported comics declare only `standard`, so they never show Flame Sigil features and need no metadata. Pages with no panels step page by page; Sigil View frames the whole page.

## Commerce: three separate questions

1. **Availability**: has the publisher released it (draft, scheduled, published, archived, unavailable)?
2. **Entitlement**: may this reader read it (purchase, subscription, promotion, reward, grant), and was the record store-verified, server-verified or sandbox?
3. **Collectible ownership**: does the reader own a numbered edition token (reserved, minted-unverified, verified)?

`resolveAccess()` combines (1), (2) and the publisher's `AccessPolicy` into one of ten states. Collectibles are never an input to access (App Store guideline 3.1.1). See `docs/v0.2/02-COMMERCE.md`.

## Content pipeline

`content-src/*.json` (editorial) → `npm run build-manifests` → `src/content/manifests/*.json` (hashed, sized, ed25519-signed) → validated and signature-checked at startup → `catalog.ts` getters. Newer manifests from a content service go through the same `installManifest()` gate and must carry a production-trusted signature. Paid and unpublished pages never have public URLs; the backend issues signed URLs after an entitlement check.

## State

`ReaderState` v2 is one JSON document persisted with `expo-sqlite/kv-store` (web: `localStorage`). It holds progress (with timestamps for future sync), preferences, library metadata, bookmarks, history, the Ember event log, the commerce ledger and achievements. v1 states migrate losslessly. Imported page files live outside state: in app documents (native) or IndexedDB (web).

## Imports

`services/importer.ts` (picker, bytes) → `domain/import/pipeline.ts` (pure) → `services/page-store` (filesystem / IndexedDB). CBZ is parsed by a purpose-built ZIP reader that enforces every limit before inflating and checks each page's CRC. PDF pages are rendered by the platform's own engine through `modules/echo-pdf`.

## Verification

`npm run verify` = TypeScript, Jest (domain, state, catalog, manifests, import security, server parity), ESLint, manifest freshness, and Postgres security tests (`scripts/test-db.mjs`).
