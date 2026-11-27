# EchoReader

**Beyond the Page.** A free comic and manga reader for anyone, and the official home of **Flame Sigil** and the Echoverse. One TypeScript codebase ships to **iOS** and **Android** (Expo SDK 58 / React Native 0.88), with a web build used for QA.

> Make the reader free. Make the story worth paying for. Make ownership worth collecting.

## What's in v0.2

| Area | Status |
| --- | --- |
| **Free personal library** | Import **CBZ, JPEG, PNG, WebP** (verified) and **PDF** (native renderer, needs a device build). Collections, favorites, metadata editing, cover choice, removal. Files never leave the device; no account needed. |
| **Reading** | Scroll and Pages for everything; **Sigil View** for publications with authored panels. Fit page/width/height, pinch and double-tap zoom, LTR/RTL, tablet spreads, dark/light background, bookmarks, history, Reduce Motion support, manual panel controls. |
| **Flame Sigil** | Approved catalog (Prologue to Chapter Six) from a **signed publication manifest**. The Prologue (6 pages) and Chapter One: Signal Lost (14 pages) are complete and free. Later chapters show approved titles and await their masters. |
| **Echo Layer · Spoiler Shield · Nine Fragments** | Preserved from v0.1 and now gated by publication capabilities. Glyph discoveries earn Embers. |
| **Commerce** | Publisher-controlled access (10 states), Standard / Collector / Legendary editions ($4.99 / $9.99 / $19.99, all configurable), idempotent purchase ledger, refunds, restore. **Sandbox purchases only**; real store billing isn't built. |
| **Embers** | Rule-based, idempotent, capped, non-transferable rewards. Not money; they never unlock paid chapters unless a publisher opts in per chapter. |
| **Vault** | Embers, editions, collectibles (honestly labeled: Sandbox, Reserved, Verified), Genesis/Elemental Sigils (not yet issued), fragments, achievements, verification records. |
| **POW** | Page-level SHA-256 integrity plus publication hash, edition and publisher IDs, versioned manifests and ed25519 issuer signatures. Integrity is never presented as proof of copyright or ownership. |
| **Backend foundation** | Supabase schema with row-level security (tested against Postgres), server-side page authorization, signed-URL edge function. **Not deployed.** |
| **Privacy** | Analytics off by default, never includes imported comic names, synthetic events flagged; on-device data erase. |

Full status per feature: [docs/v0.2/01-SUMMARY.md](docs/v0.2/01-SUMMARY.md).

## Run it

```bash
npm install
npx expo start
```

EchoReader uses native modules (SQLite, haptics, document picker and its own PDF module), so run a **development build**, not Expo Go:

```bash
npx expo run:ios                 # Xcode
npx expo run:android             # Android Studio
npx eas-cli@latest build --profile development-simulator --platform ios
npx eas-cli@latest build --profile development --platform android
```

| Environment variable | Effect |
|---|---|
| `EXPO_PUBLIC_COMMERCE=sandbox` | Enable sandbox purchases in a release build (always on in development) |
| `EXPO_PUBLIC_CONTENT_URL` | Content service base URL (remote manifests; not live yet) |
| `EXPO_PUBLIC_SUPABASE_URL` | Backend for accounts and sync (not wired yet) |

## Verify

```bash
npm run verify            # typecheck, 138 Jest tests, lint, manifest check, Postgres RLS tests
npm run build-manifests   # after editing content-src/ or page art: rehash and re-sign
npm run test:db           # backend schema + security rules against Postgres (PGlite)
npm run keygen -- <path>  # create a production manifest-signing key (keep it private)
```

## Project map

```
src/domain/        pure rules: commerce, rewards, library, import, manifest, signature, POW, Sigil, spoilers
src/content/       catalog from signed manifests, lore pack, trusted issuers
src/state/         ReaderState v2 reducer, persistence, derived hooks, shelves
src/services/      importer, page store, commerce, identity, analytics, POW hashing, config
src/reader/        Sigil / Scroll / Pages readers, zoom, sheets
src/app/           screens: Home, Discover, Library, Vault, Profile, reader, editions, series, Codex, Cypher…
modules/echo-pdf/  local Expo module: PDF rendering with PDFKit / PdfRenderer
content-src/       approved editorial metadata → manifests
supabase/          schema + RLS, edge function (foundation)
scripts/           build-manifests, keygen, test-db
docs/              ARCHITECTURE.md, CONTENT.md, v0.2/ (audit, commerce, data, manifest spec, security, test report, summary)
```

## License

- **Source code:** MIT. See [LICENSE](LICENSE).
- **Story, art, characters and brand marks:** © 2026 TalonSight Technologies, All Rights Reserved. See [LICENSE-CONTENT.md](LICENSE-CONTENT.md). Forks must replace this content with their own.
