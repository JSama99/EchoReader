# Content: what’s real, what’s placeholder, and how to add a chapter

## Real (from the creator)

| File | Used for |
| --- | --- |
| `assets/content/flame-sigil/fs_cover.jpg` | Library hero, shelf, Discover, series thumbnails |
| `assets/content/flame-sigil/malik_portrait.jpg` | Codex: Malik Blaze portrait (cropped from the “Malik Blaze: The Flame Awakens” poster) |
| `assets/content/flame-sigil/ch1_p04.jpg` | Chapter 1, page 4 |
| `assets/content/flame-sigil/ch1_p22_finale.jpg` | Chapter 1, final page (“End of Chapter One”) |

Panel geometry on page 4 was measured from the art: the horizontal gutters sit at y ≈ 327, 614, 909 and 1164 px. Glyph rects on the finale were overlaid on the art and checked visually.

Codex text uses only canon facts (Malik Blaze is a Phoenix Elemental, Ayana Storm is a Storm Elemental, Maestro Re:Verse is Malik’s brother) and words drawn from the pages’ own captions.

## Placeholder (replace with canon)

- **Chapter 1 is a two-page preview** (page 4 + finale) because only those pages exist so far.
- **Chapter 1 title** “The Verse Begins Again” comes from the finale caption. Confirm or rename.
- **Fragment I** “The True Signal” is placed on the finale’s last panel. Fragments II–IX are not placed.
- **Reveal positions:** Malik’s sealed line (“His brother is Maestro Re:Verse”) is set to reveal at Chapter 2.
- **Chapter 2** is scheduled for Fri Nov 27 2026, 9:00 AM ET (free 24h later) with no pages yet. It demonstrates the early-access flow.
- **Cypher comments** in `catalog.ts` are sample data so the thread UI can be reviewed.
- **Credits** in `editions.json` are “Creator: J-Sama” and “Publisher: TalonSight Technologies”. Add the artist and letterer credits. Credits are part of the POW hash.

## Add a chapter

1. Export pages as JPEG (≈1024 px wide is plenty on phones; up to 2048 for tablets) into `assets/content/<series>/`.
2. Add the files to `src/content/images.ts` (`pageImages`). Metro needs static `require()` calls.
3. Add the chapter to `src/content/editions.json` with credits and page order.
4. Add the chapter to `src/content/catalog.ts`:
   - `panels`: one normalized rect per panel, in reading order. Rects may overlap for diagonal gutters.
   - `glyphs`: a normalized rect plus `codexEntryId` and the `panel` index where the glyph becomes discoverable.
   - Set `publishedAt` and `freeAt` so the gap is ≤ 24h. Tests fail otherwise.
5. Run `npm run hash-content` to regenerate the POW ledger, then `npm run verify`.

The catalog tests catch out-of-page rects, glyphs pointing at missing entries or panels, Codex lines revealed before their entry, unfair schedules, credit/page-order drift and stale hashes.

## Right-to-left (manga) titles

Set `direction: 'rtl'` and `defaultMode: 'pages'` on the series and author `panels` in RTL reading order. Tap zones and swipe direction invert automatically.
