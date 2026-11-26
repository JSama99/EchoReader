import type { ReadingMode, Series } from './types';

/**
 * Mode resolution order:
 * 1. A mode the reader saved for this specific series ("remember for this series").
 * 2. The reader's global default from onboarding.
 * 3. The series' authored default (manga defaults to Pages, read RTL).
 */
export function resolveMode(
  series: Series,
  perSeries: Readonly<Record<string, ReadingMode>>,
  globalDefault: ReadingMode | undefined,
): ReadingMode {
  return perSeries[series.id] ?? globalDefault ?? series.defaultMode;
}

export const MODE_LABEL: Record<ReadingMode, string> = {
  sigil: 'Sigil View',
  scroll: 'Scroll',
  pages: 'Pages',
};
