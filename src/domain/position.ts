import type { Position } from './types';

/** Nothing read yet. Below every real position, including a prologue (chapter 0). */
export const START: Position = { chapter: -1, page: 0, panel: 0 };

/** Negative if a < b, 0 if equal, positive if a > b. */
export function comparePositions(a: Position, b: Position): number {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  if (a.page !== b.page) return a.page - b.page;
  return a.panel - b.panel;
}

export function maxPosition(a: Position, b: Position): Position {
  return comparePositions(a, b) >= 0 ? a : b;
}

/** True when `target` is at or before `furthest`: the reader has seen it. */
export function isReached(target: Position, furthest: Position): boolean {
  return comparePositions(target, furthest) <= 0;
}

export function formatPosition(p: Position, pageLabel?: string): string {
  return `Ch. ${p.chapter} · p. ${pageLabel ?? p.page + 1} · panel ${p.panel + 1}`;
}
