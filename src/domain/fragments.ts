import { comparePositions, isReached } from './position';
import type { Fragment, Position } from './types';

export const TOTAL_FRAGMENTS = 9;

export type FragmentProgress = {
  found: Fragment[];
  next?: Fragment;
  count: number;
  total: number;
  /** All nine found: the Origin prequel opens. */
  originUnlocked: boolean;
};

export function fragmentProgress(fragments: Fragment[], furthest: Position): FragmentProgress {
  const sorted = [...fragments].sort((a, b) => a.ordinal - b.ordinal);
  const found = sorted.filter((f) => isReached(f.foundAt, furthest));
  const next = sorted
    .filter((f) => !isReached(f.foundAt, furthest))
    .sort((a, b) => comparePositions(a.foundAt, b.foundAt))[0];
  return {
    found,
    next,
    count: found.length,
    total: TOTAL_FRAGMENTS,
    originUnlocked: found.length >= TOTAL_FRAGMENTS,
  };
}

/**
 * Fragments crossed when the reader moves from `before` to `after`.
 * Used to trigger the "Fragment earned" moment exactly once.
 */
export function newlyFound(fragments: Fragment[], before: Position, after: Position): Fragment[] {
  if (comparePositions(after, before) <= 0) return [];
  return fragments
    .filter((f) => !isReached(f.foundAt, before) && isReached(f.foundAt, after))
    .sort((a, b) => a.ordinal - b.ordinal);
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [v, s] of map) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}
