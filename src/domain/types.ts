/**
 * EchoReader domain types.
 *
 * Everything in src/domain is pure TypeScript: no React, no Expo, no I/O.
 * That keeps the rules (spoilers, access, provenance, panel camera) testable
 * with plain Jest and identical on iOS, Android and web.
 */

/** A rectangle in page-relative units: 0..1 on both axes, origin top-left. */
export type NormRect = { x: number; y: number; w: number; h: number };

export type ReadingDirection = 'ltr' | 'rtl';
export type ReadingMode = 'sigil' | 'scroll' | 'pages';

/**
 * A point in a series' reading order. Comparison is lexicographic on
 * (chapter, page, panel). Page and panel are 0-based indexes into the manifest.
 */
export type Position = { chapter: number; page: number; panel: number };

export type Panel = {
  id: string;
  /** Camera target for Sigil View. Panels may overlap (diagonal gutters). */
  rect: NormRect;
};

export type GlyphHotspot = {
  id: string;
  rect: NormRect;
  codexEntryId: string;
  /** Index of the panel on the same page where the glyph becomes discoverable. */
  panel: number;
};

export type Page = {
  id: string;
  /** Printed label, e.g. "4" or "End". */
  label: string;
  /** Pixel size of the source art; used for aspect ratio. */
  width: number;
  height: number;
  panels: Panel[];
  glyphs: GlyphHotspot[];
  /** Cypher thread key for each panel id, if discussion is open. */
};

export type Credit = { role: string; name: string };

export type Chapter = {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  /** ISO timestamp the chapter went live for early access. */
  publishedAt: string;
  /** ISO timestamp the chapter becomes free for everyone. */
  freeAt: string;
  pages: Page[];
  credits: Credit[];
};

export type Series = {
  id: string;
  title: string;
  tagline: string;
  direction: ReadingDirection;
  defaultMode: ReadingMode;
  chapterIds: string[];
  status: 'live' | 'coming-soon';
  /** Expected release date for coming-soon series. */
  releaseLabel?: string;
};

export type CodexLine = {
  text: string;
  /** Earliest reading position at which this line may be shown. */
  revealAt: Position;
};

export type CodexEntry = {
  id: string;
  seriesId: string;
  kind: 'character' | 'glyph' | 'place' | 'lore';
  name: string;
  tags: string[];
  /** Position of first appearance; the entry is hidden before it. */
  firstSeen: Position;
  lines: CodexLine[];
  bondIds?: string[];
};

export type Fragment = {
  id: string;
  /** 1..9 */
  ordinal: number;
  title: string;
  seriesId: string;
  foundAt: Position;
};

export type CypherComment = {
  id: string;
  panelKey: string;
  author: string;
  isCreator: boolean;
  body: string;
  createdAt: string;
  votes: number;
  tag?: 'theory' | 'hype' | 'art';
  /** If the comment discusses later events, the position it spoils. */
  spoilsAt?: Position;
  replies?: CypherComment[];
};

/** Ledger record published alongside a chapter (POW Ledger). */
export type LedgerRecord = {
  chapterId: string;
  pageHashes: string[];
  /** Byte size of each page file, for storage display. */
  pageBytes?: number[];
  chapterHash: string;
};
