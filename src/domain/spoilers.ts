import { isReached } from './position';
import type { CodexEntry, CypherComment, GlyphHotspot, Position } from './types';

/**
 * Spoiler shield. One rule everywhere: nothing past the reader's furthest-read
 * panel is shown. The Codex, Echo cards and the Cypher all go through here.
 */

export type ShieldedEntry = {
  entry: CodexEntry;
  visibleLines: string[];
  sealedCount: number;
  /** Earliest position that would unseal the next line, if any. */
  nextReveal?: Position;
};

export function isEntryDiscovered(entry: CodexEntry, furthest: Position): boolean {
  return isReached(entry.firstSeen, furthest);
}

export function shieldEntry(entry: CodexEntry, furthest: Position): ShieldedEntry {
  const visible = entry.lines.filter((l) => isReached(l.revealAt, furthest));
  const sealed = entry.lines.filter((l) => !isReached(l.revealAt, furthest));
  const next = sealed
    .map((l) => l.revealAt)
    .sort((a, b) => a.chapter - b.chapter || a.page - b.page || a.panel - b.panel)[0];
  return {
    entry,
    visibleLines: visible.map((l) => l.text),
    sealedCount: sealed.length,
    nextReveal: next,
  };
}

/** Codex index: only entries the reader has met, in first-seen order. */
export function discoveredEntries(entries: CodexEntry[], furthest: Position): CodexEntry[] {
  return entries
    .filter((e) => isEntryDiscovered(e, furthest))
    .sort(
      (a, b) =>
        a.firstSeen.chapter - b.firstSeen.chapter ||
        a.firstSeen.page - b.firstSeen.page ||
        a.firstSeen.panel - b.firstSeen.panel,
    );
}

/** Glyphs on a page that the reader has reached (by panel) are tappable. */
export function activeGlyphs(
  glyphs: GlyphHotspot[],
  chapter: number,
  page: number,
  furthest: Position,
): GlyphHotspot[] {
  return glyphs.filter((g) => isReached({ chapter, page, panel: g.panel }, furthest));
}

export type ShieldedComment = Omit<CypherComment, 'replies'> & { folded: boolean; replies?: ShieldedComment[] };

/** Fold (never delete) comments that discuss events the reader hasn't reached. */
export function shieldComments(comments: CypherComment[], furthest: Position): ShieldedComment[] {
  return comments.map((c) => ({
    ...c,
    folded: c.spoilsAt ? !isReached(c.spoilsAt, furthest) : false,
    replies: c.replies ? shieldComments(c.replies, furthest) : undefined,
  }));
}
