import { useEffect, useState } from 'react';

import { chaptersOf, fragments as allFragments } from '@/content/catalog';
import { accessFor, type AccessState } from '@/domain/access';
import { fragmentProgress } from '@/domain/fragments';
import { START } from '@/domain/position';
import { chapterProgress } from '@/domain/sigil';
import type { Chapter, Position } from '@/domain/types';

import type { ReaderState } from './model';
import { useReader } from './store';

/** Ticking clock for countdowns; updates every `ms`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const furthestOf = (s: ReaderState, seriesId: string): Position => s.furthest[seriesId] ?? START;

export function useFurthest(seriesId: string): Position {
  return useReader((s) => furthestOf(s, seriesId));
}

export function useFragments(seriesId: string) {
  const furthest = useFurthest(seriesId);
  return fragmentProgress(allFragments.filter((f) => f.seriesId === seriesId), furthest);
}

export function useAccess(chapter: Chapter | undefined, now: number): AccessState | undefined {
  const embers = useReader((s) => s.embers);
  const unlocked = useReader((s) => s.unlockedChapterIds);
  if (!chapter) return undefined;
  return accessFor(chapter, now, new Set(unlocked), embers);
}

export type ContinueInfo = {
  chapter: Chapter;
  position: Position;
  progress: number;
  pageLabel: string;
};

/** Where to resume a series, or the first chapter if never opened. */
export function continueFor(s: ReaderState, seriesId: string): ContinueInfo | undefined {
  const list = chaptersOf(seriesId).filter((c) => c.pages.length > 0);
  if (list.length === 0) return undefined;
  const pos = s.current[seriesId];
  const chapter = (pos && list.find((c) => c.number === pos.chapter)) || list[0];
  const position = pos && pos.chapter === chapter.number ? pos : { chapter: chapter.number, page: 0, panel: 0 };
  return {
    chapter,
    position,
    progress: chapterProgress(chapter.pages, { page: position.page, panel: position.panel }),
    pageLabel: chapter.pages[position.page]?.label ?? '1',
  };
}
