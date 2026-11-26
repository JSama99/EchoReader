# EchoReader

The reader for Flame Sigil and the Echoverse. One TypeScript codebase ships to **iOS** and **Android** (Expo SDK 58 / React Native 0.88), with a web build used for QA.

Design source: Paper file **“EchoReader — Flame Sigil”** (Research & Spec, Mobile, Desktop, Tablet pages). Colors, type and spacing here mirror its Kiln tokens one-to-one (`src/theme/tokens.ts`).

## What’s in v0.1

| Area | What works |
| --- | --- |
| **Reading** | Three modes. **Sigil View** frames one panel at a time with an animated camera and spotlight. **Scroll** is a continuous strip. **Pages** swipes whole pages and pairs them into two-page spreads on landscape tablets. Right-to-left books invert tap zones and swipe direction. The mode can be saved per series. |
| **Echo Layer** | Gold glyph hotspots on the art open Codex entries. A glyph only becomes tappable once the reader reaches its panel. In Sigil View, taps are resolved by inverting the camera, so glyphs never fight the tap zones. |
| **Spoiler shield** | The Codex, Echo cards and Cypher threads never show anything past the reader’s furthest panel. Spoiler comments are folded, not deleted. Deep links to sealed entries redirect. |
| **Nine Fragments** | Progress tracking. A fragment moment plays exactly once, at the panel where the fragment is found. Origin unlocks at 9/9. |
| **Fair access** | Chapters become free for everyone within 24h (enforced by tests on catalog data). An Ember unlocks early. Readers earn one Ember per ISO week in which they finish a chapter. No ads, no paid waits. |
| **POW-verified editions** | Each page is SHA-256 hashed on the device and compared with the ledger record. A mismatch names the exact pages and never blocks reading. |
| **Cypher** | Threads pinned to panels, sorted by Top/Newest/Creator, with creator badges and folded spoilers. Posting is stubbed until the service exists. |
| **Library / Discover / Codex / Downloads / Profile / Onboarding** | Built to the Paper designs, persisted on device (SQLite key-value store). |

Real Flame Sigil art ships in the bundle: the cover, Malik Blaze’s portrait, page 4 and the Chapter One finale. See `docs/CONTENT.md` for what is real and what is placeholder.

## Run it

```bash
npm install
npx expo start            # press i (iOS simulator) or a (Android emulator)
```

EchoReader uses native modules, including SQLite, haptics and the dev client, so run it as a **development build**, not in Expo Go:

```bash
npx expo run:ios          # needs Xcode
npx expo run:android      # needs Android Studio
# or build in the cloud:
npx eas-cli@latest build --profile development-simulator --platform ios
npx eas-cli@latest build --profile development --platform android
```

Store builds: `npx eas-cli@latest build --profile production --platform all`. Bundle IDs are `com.talonsight.echoreader` on both platforms. Change them in `app.json` before the first store submission if needed.

## Verify

```bash
npm run verify            # typecheck + 57 unit tests + lint + ledger check
npm run hash-content      # regenerate POW ledger after changing any page art
node scripts/hash-content.mjs --check   # CI: fail if the ledger is stale
```

## Project map

```
src/
  domain/      Pure rules, no React: spoilers, access/Embers, fragments, POW, Sigil camera, mode resolution
  content/     Catalog (series, chapters, panels, glyphs, Codex, Cypher seed), editions.json, generated ledger
  state/       Reader state (pure reducer + persisted store), derived hooks, platform key-value storage
  services/    Device-side POW hashing (expo-asset + expo-file-system + expo-crypto)
  reader/      Sigil / Scroll / Pages readers, page art with glyphs & pins, sheets (Echo, settings, POW)
  ui/          Kiln kit: type, buttons, chips, toggles, segmented, icons, POW seal
  theme/       Tokens from the Paper file
  app/         Expo Router screens
__tests__/     domain, catalog integrity + ledger, state/store
scripts/       hash-content.mjs (POW ledger builder)
docs/          ARCHITECTURE.md, CONTENT.md
```

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/CONTENT.md](docs/CONTENT.md)

## License

Copyright © 2026 TalonSight Technologies. All Rights Reserved. Proprietary. See [LICENSE](LICENSE).
