import type { CodexEntry, CypherComment, Fragment } from '@/domain/types';

/**
 * Flame Sigil lore pack: Codex, fragments, sample Cypher discussion.
 * Approved story material only. Never add Elementals, histories or canon here
 * that the creator has not published.
 *
 * Placeholder (see docs/CONTENT.md): Codex line placement, Fragment I
 * placement, and every Cypher comment (sample discussion, labeled in the UI).
 */

const P = (chapter: number, page: number, panel: number) => ({ chapter, page, panel });

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
    lines: [{ text: 'Storm Elemental. Her spiral pendant glows the same blue as the lightning she calls.', revealAt: P(1, 1, 2) }],
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

/**
 * SAMPLE discussion for design and QA. Shown with a "Sample discussion" label.
 * Panel keys are `${pageId}:${panelId}`.
 */
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
