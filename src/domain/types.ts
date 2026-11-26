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
 * What a publication supports. The core reader needs only 'standard'; every
 * other capability is opt-in metadata, and the UI shows only what is declared.
 */
export type Capability =
  | 'standard'
  | 'sigil'
  | 'echo'
  | 'annotations'
  | 'codex'
  | 'fragments'
  | 'cypher'
  | 'soundtrack'
  | 'verification'
  | 'collectibles'
  | 'blockchain';

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
  /**
   * Where the art lives when it is not bundled: a file:// URI for imported
   * comics, an idb:// key on web, or an authorized https URL for remote pages.
   */
  src?: string;
  /** Printed label, e.g. "4" or "End". */
  label: string;
  /** Pixel size of the source art; used for aspect ratio. */
  width: number;
  height: number;
  panels: Panel[];
  glyphs: GlyphHotspot[];
};

export type Credit = { role: string; name: string };

/**
 * complete         every page of the approved master is present
 * excerpt          a demonstration subset of an approved master
 * awaiting-master  metadata is approved; pages have not been supplied
 */
export type ContentStatus = 'complete' | 'excerpt' | 'awaiting-master';

/** A readable unit (a chapter of a series, or one imported comic). */
export type Chapter = {
  id: string;
  seriesId: string;
  /** Reading order within the series. The prologue is 0. */
  number: number;
  /** Display label, e.g. "Prologue" or "Chapter One". */
  label?: string;
  title: string;
  description?: string;
  contentStatus: ContentStatus;
  pages: Page[];
  credits: Credit[];
};

export type Series = {
  id: string;
  publisherId: string;
  title: string;
  tagline: string;
  direction: ReadingDirection;
  defaultMode: ReadingMode;
  capabilities: Capability[];
  chapterIds: string[];
  status: 'live' | 'coming-soon';
  /** Approved label for coming-soon series. */
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
