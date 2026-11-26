import type {
  Chapter,
  CodexEntry,
  CypherComment,
  Fragment,
  LedgerRecord,
  Page,
  Series,
} from '@/domain/types';

import editions from './editions.json';
import ledger from './ledger.generated.json';

/**
 * Bundled catalog. In production this comes from the content service; the
 * shape is identical so screens never know the difference.
 *
 * Real: page art, page panel/glyph geometry (measured from the art), credits.
 * Placeholder (see docs/CONTENT.md): Codex line placement, Fragment I
 * placement, Chapter 2 schedule, Cypher sample comments.
 */

const P = (chapter: number, page: number, panel: number) => ({ chapter, page, panel });

const credits = (chapterId: string) =>
  editions.chapters.find((c) => c.chapterId === chapterId)?.credits ?? [];

// ── Flame Sigil · Chapter 1 ─────────────────────────────────────────────────

const ch1Page4: Page = {
  id: 'fs1-p04',
  label: '4',
  width: 1024,
  height: 1536,
  // Gutters measured from the art: horizontal bands at y≈327, 614, 909, 1164 px.
  panels: [
    { id: 'marta', rect: { x: 0, y: 0, w: 1, h: 0.2129 } },
    { id: 'sweet-auburn', rect: { x: 0, y: 0.2155, w: 1, h: 0.1836 } },
    { id: 'ebenezer', rect: { x: 0, y: 0.4023, w: 0.4, h: 0.1888 } },
    { id: 'bell', rect: { x: 0.371, y: 0.4023, w: 0.629, h: 0.1888 } },
    { id: 'patchwerk', rect: { x: 0, y: 0.5944, w: 0.6055, h: 0.1628 } },
    { id: 'console', rect: { x: 0.469, y: 0.5944, w: 0.531, h: 0.1628 } },
    { id: 'skyline', rect: { x: 0, y: 0.7604, w: 1, h: 0.2396 } },
  ],
  glyphs: [
    // The dissonant second "BONG" — the pulse made visible.
    { id: 'g-bell-echo', rect: { x: 0.6, y: 0.5, w: 0.25, h: 0.075 }, codexEntryId: 'the-pulse', panel: 3 },
  ],
};

const ch1Finale: Page = {
  id: 'fs1-end',
  label: 'End',
  width: 1199,
  height: 1312,
  panels: [
    { id: 'splash', rect: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 'malik', rect: { x: 0.075, y: 0.09, w: 0.46, h: 0.91 } },
    { id: 'ayana', rect: { x: 0.467, y: 0.09, w: 0.49, h: 0.91 } },
    { id: 'true-signal', rect: { x: 0.7, y: 0.6, w: 0.3, h: 0.4 } },
  ],
  // Glyph rects verified by overlaying them on the art (see docs/CONTENT.md).
  glyphs: [
    { id: 'g-phoenix-sleeve', rect: { x: 0.165, y: 0.305, w: 0.13, h: 0.1 }, codexEntryId: 'malik-blaze', panel: 1 },
    { id: 'g-forearm-sigil', rect: { x: 0.135, y: 0.49, w: 0.135, h: 0.2 }, codexEntryId: 'flame-sigil-mark', panel: 1 },
    { id: 'g-storm-pendant', rect: { x: 0.718, y: 0.395, w: 0.065, h: 0.06 }, codexEntryId: 'ayana-storm', panel: 2 },
  ],
};

export const chapters: Chapter[] = [
  {
    id: 'flame-sigil-1',
    seriesId: 'flame-sigil',
    number: 1,
    title: 'The Verse Begins Again',
    publishedAt: '2026-11-20T14:00:00.000Z',
    freeAt: '2026-11-21T14:00:00.000Z',
    pages: [ch1Page4, ch1Finale],
    credits: credits('flame-sigil-1'),
  },
  {
    id: 'flame-sigil-2',
    seriesId: 'flame-sigil',
    number: 2,
    title: 'Chapter 2',
    publishedAt: '2026-11-27T14:00:00.000Z',
    freeAt: '2026-11-28T14:00:00.000Z',
    pages: [],
    credits: [],
  },
];

export const series: Series[] = [
  {
    id: 'flame-sigil',
    title: 'Flame Sigil',
    tagline: 'Where rhythm, memory, and power collide.',
    direction: 'ltr',
    defaultMode: 'sigil',
    chapterIds: ['flame-sigil-1', 'flame-sigil-2'],
    status: 'live',
  },
  {
    id: 'echo-state',
    title: 'Echo State',
    tagline: 'The Echoverse expands.',
    direction: 'ltr',
    defaultMode: 'scroll',
    chapterIds: [],
    status: 'coming-soon',
    releaseLabel: 'Coming soon',
  },
  {
    id: 'flame-sigil-origin',
    title: 'Flame Sigil: Origin',
    tagline: 'The prequel. Opens when all nine fragments are found.',
    direction: 'ltr',
    defaultMode: 'sigil',
    chapterIds: [],
    status: 'coming-soon',
    releaseLabel: 'Unlocks at 9/9',
  },
];

export const codex: CodexEntry[] = [
  {
    id: 'the-pulse',
    seriesId: 'flame-sigil',
    kind: 'lore',
    name: 'The Pulse',
    tags: ['Phenomenon', 'Atlanta'],
    firstSeen: P(1, 0, 0),
    lines: [
      { text: 'A rhythm that rippled through the sacred and the mundane alike: MARTA, Sweet Auburn, Ebenezer, the studios.', revealAt: P(1, 0, 0) },
      { text: 'At Ebenezer the hour bell rang as always, but its echo came back wrong, with another note hidden beneath it.', revealAt: P(1, 0, 3) },
      { text: 'Most folks heard noise. The real city was tuning itself.', revealAt: P(1, 0, 6) },
    ],
  },
  {
    id: 'malik-blaze',
    seriesId: 'flame-sigil',
    kind: 'character',
    name: 'Malik Blaze',
    tags: ['Phoenix Elemental', 'Protagonist'],
    firstSeen: P(1, 1, 1),
    lines: [
      { text: 'Phoenix Elemental. The flame answers when the city finds its rhythm.', revealAt: P(1, 1, 1) },
      { text: 'Stands with Ayana Storm, fire beside lightning, at the end of Chapter One.', revealAt: P(1, 1, 3) },
      { text: 'His brother is Maestro Re:Verse.', revealAt: P(2, 0, 0) },
    ],
    bondIds: ['ayana-storm'],
  },
  {
    id: 'ayana-storm',
    seriesId: 'flame-sigil',
    kind: 'character',
    name: 'Ayana Storm',
    tags: ['Storm Elemental', 'Protagonist'],
    firstSeen: P(1, 1, 2),
    lines: [
      { text: 'Storm Elemental. Her spiral pendant glows the same blue as the lightning she calls.', revealAt: P(1, 1, 2) },
    ],
    bondIds: ['malik-blaze'],
  },
  {
    id: 'flame-sigil-mark',
    seriesId: 'flame-sigil',
    kind: 'glyph',
    name: 'The Flame Sigil',
    tags: ['Glyph'],
    firstSeen: P(1, 1, 1),
    lines: [
      { text: 'The spiral mark that burns along Malik’s forearm when the power rises.', revealAt: P(1, 1, 1) },
      { text: 'Its full meaning is written across the nine manuscript fragments.', revealAt: P(1, 1, 3) },
    ],
  },
];

export const fragments: Fragment[] = [
  { id: 'fragment-1', ordinal: 1, title: 'The True Signal', seriesId: 'flame-sigil', foundAt: P(1, 1, 3) },
];

/** Panel keys are `${pageId}:${panelId}`. Sample data until the Cypher service ships. */
export const cypher: CypherComment[] = [
  {
    id: 'c-1',
    panelKey: 'fs1-p04:bell',
    author: 'kemet.kid',
    isCreator: false,
    tag: 'theory',
    body: 'The second BONG is drawn in the same purple as the pulse line at Sweet Auburn. Same signal?',
    createdAt: '2026-11-25T18:20:00.000Z',
    votes: 1400,
    replies: [
      {
        id: 'c-1-r1',
        panelKey: 'fs1-p04:bell',
        author: 'J-Sama',
        isCreator: true,
        body: 'Listen closer. The city keeps time.',
        createdAt: '2026-11-25T19:02:00.000Z',
        votes: 980,
      },
    ],
  },
  {
    id: 'c-2',
    panelKey: 'fs1-p04:bell',
    author: 'peachtreeprophet',
    isCreator: false,
    body: 'Wait till you see who rings it in chapter 2.',
    createdAt: '2026-11-26T08:40:00.000Z',
    votes: 212,
    spoilsAt: P(2, 0, 0),
  },
  {
    id: 'c-3',
    panelKey: 'fs1-p04:bell',
    author: 'westend.wren',
    isCreator: false,
    tag: 'hype',
    body: 'Ebenezer and Patchwerk on the same page. This is Atlanta.',
    createdAt: '2026-11-26T09:01:00.000Z',
    votes: 312,
  },
  {
    id: 'c-4',
    panelKey: 'fs1-end:true-signal',
    author: 'westend.wren',
    isCreator: false,
    tag: 'art',
    body: 'Fire on the left, lightning on the right, both looking up. Chills.',
    createdAt: '2026-11-26T09:05:00.000Z',
    votes: 98,
  },
];

export const ledgerRecords: LedgerRecord[] = ledger.records;

// ── Lookups ─────────────────────────────────────────────────────────────────

export const getSeries = (id: string) => series.find((s) => s.id === id);
export const getChapter = (id: string) => chapters.find((c) => c.id === id);
export const getEntry = (id: string) => codex.find((e) => e.id === id);
export const chaptersOf = (seriesId: string) =>
  chapters.filter((c) => c.seriesId === seriesId).sort((a, b) => a.number - b.number);
export const ledgerFor = (chapterId: string) => ledgerRecords.find((r) => r.chapterId === chapterId);
export const panelKey = (page: Page, panelIndex: number) => `${page.id}:${page.panels[panelIndex]?.id ?? panelIndex}`;
export const commentsFor = (key: string) => cypher.filter((c) => c.panelKey === key);
export const commentCount = (key: string) =>
  commentsFor(key).reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);
