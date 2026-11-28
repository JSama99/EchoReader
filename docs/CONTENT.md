# Content: what's real, what's placeholder, and how to publish a chapter

## Approved catalog (from the v0.2 brief)

Prologue · Chapter One, Signal Lost · Chapter Two, White Silence · Chapter Three, Loop Season · Chapter Four, Roots Run Deep · Chapter Five, Cipher Temple · Chapter Six, Smoke and Static. Later chapters are added only with approved metadata. **Never invent titles, dates or lore.**

## Real (from the creator)

| File | Used for |
| --- | --- |
| `assets/content/flame-sigil/fs_cover.jpg` | Home hero, shelves, Discover |
| `assets/content/flame-sigil/malik_portrait.jpg` | Codex portrait for Malik Blaze |
| `assets/content/flame-sigil/prologue_p01.png` … `prologue_p06.png` | Prologue, pages 1–6 (complete; added 2026-11-27) |
| `assets/content/flame-sigil/ch1_p01.png` … `ch1_p14.png` | Chapter One: Signal Lost, pages 1–14 (complete website masters; added 2026-11-27) |

Prologue panel boxes were measured from the pure-white gutters in each page (32 panels). Page 1 is a single splash, framed as five reading beats: the full scene, the first balloon, the timeline screen, the second balloon and the closing caption. Page 3's slanted top border is split into the elder and the burning city. Chapter One's 83 panels were authored the same way against a pixel grid; slanted borders are framed by bounding boxes. Page 3's layout is identical to the v0.1 excerpt page and kept its geometry. Glyph rects on page 14 were checked at full resolution.

## Placeholder or pending (marked in the data)

- **Chapter One: Signal Lost is complete**: 14 pages from the website masters. The two v0.1 excerpt pages were retired; the old page 4 art is kept only as a test fixture (`__tests__/fixtures/sample-page.jpg`).
- **Chapters Two to Six** are `awaiting-master` with `availability: draft`. They have no pages, dates or descriptions until approved masters arrive.
- **The Prologue** is complete and free. It has no Echo glyphs or Codex entries yet; those need creator-approved lore.
- **Echo glyphs:** the Ebenezer bell on page 3 (The Pulse); on page 14, Malik's phoenix jacket (Malik Blaze), his burning forearm (The Flame Sigil) and Ayana's pendant (Ayana Storm). Codex reveals follow those pages.
- **Fragment I** ("The True Signal") is found on page 14's closing caption. Fragments II–IX are not placed.
- **Malik's sealed line** ("His brother is Maestro Re:Verse") reveals at Chapter Two.
- **Cypher comments** in `src/content/lore.ts` are sample discussion and are labeled as such in the UI.
- **Credits** are "Creator: J-Sama" and "Publisher: TalonSight Technologies". Add artist and letterer credits; credits are part of the publication hash.
- **Legendary supply** is `null` (not set). The publisher sets the edition quantity in `content-src/flame-sigil.json`.

## Publish a chapter (bundled)

1. Put the approved page files in `assets/content/flame-sigil/` exactly as delivered (JPEG/PNG/WebP).
2. Add static `require()` entries to `src/content/images.ts` (`pageImages`), because Metro needs them.
3. Edit `content-src/flame-sigil.json`, the editorial source:
   - `pages`: `{ id, label, file, asset: "bundled:<id>", panels, glyphs }` in reading order. Panels are normalized rects; glyphs reference a Codex entry and a panel index.
   - `contentStatus`: `complete` when every page of the master is present.
   - `availability`: `published`, or `scheduled` with `releaseAt`.
   - `access`: `free`, or `paid` with `previewPages` and editions.
   - Bump `contentVersion` for the publication and `version` for the manifest, and update `issuedAt`.
4. Run `npm run build-manifests`. This hashes every page, records its pixel size, computes the publication hash and signs the manifest.
5. Run `npm run verify`.

Paid chapters must not be bundled in full: the manifest validator rejects any public `asset` on a paid page beyond the preview, and any asset on an unpublished page. Paid pages are delivered by the content service (see `docs/v0.2/06-MANIFEST-SPEC.md`).

## Right-to-left (manga) titles

Set `direction: "rtl"` on the series and publications and author `panels` in RTL reading order. Tap zones, swipe direction and spreads invert automatically. Imported comics can be switched to RTL on their detail page; CBZ files with `<Manga>YesAndRightToLeft</Manga>` in ComicInfo.xml import as RTL.
