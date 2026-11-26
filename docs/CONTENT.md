# Content: what's real, what's placeholder, and how to publish a chapter

## Approved catalog (from the v0.2 brief)

Prologue · Chapter One, Signal Lost · Chapter Two, White Silence · Chapter Three, Loop Season · Chapter Four, Roots Run Deep · Chapter Five, Cipher Temple · Chapter Six, Smoke and Static. Later chapters are added only with approved metadata. **Never invent titles, dates or lore.**

## Real (from the creator)

| File | Used for |
| --- | --- |
| `assets/content/flame-sigil/fs_cover.jpg` | Home hero, shelves, Discover |
| `assets/content/flame-sigil/malik_portrait.jpg` | Codex portrait for Malik Blaze |
| `assets/content/flame-sigil/ch1_p04.jpg` | Chapter One, page 4 |
| `assets/content/flame-sigil/ch1_p22_finale.jpg` | Chapter One, final page |

Panel geometry on page 4 was measured from the art (gutters at y ≈ 327, 614, 909 and 1164 px). Glyph rects on the finale were overlaid on the art and checked visually. Artwork is never cropped, resized or regenerated; the app displays the original files at their original aspect ratios.

## Placeholder or pending (marked in the data)

- **Chapter One is an excerpt** (`contentStatus: "excerpt"`): only page 4 and the finale exist. The v0.1 title "The Verse Begins Again" was replaced with the approved title "Signal Lost".
- **Prologue and Chapters Two to Six** are `awaiting-master` with `availability: draft`. They have no pages, dates or descriptions until approved masters arrive.
- **Fragment I** ("The True Signal") is placed on the finale's last panel. Fragments II–IX are not placed.
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
