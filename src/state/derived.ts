import { useEffect, useState, useSyncExternalStore } from 'react';

import { availabilityFor, catalogVersion, chaptersOf, editionsFor, fragments as allFragments, policyFor, subscribeCatalog } from '@/content/catalog';
import { resolveAccess, type AccessState } from '@/domain/commerce/access';
import { fragmentProgress } from '@/domain/fragments';
import { localKey, type LocalPublication } from '@/domain/library';
import { START } from '@/domain/position';
import { balance } from '@/domain/rewards';
import { chapterProgress } from '@/domain/sigil';
import type { Chapter, Position } from '@/domain/types';
import { TRUST } from '@/services/config';

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

/** Re-render when a newer manifest is installed. */
export function useCatalogVersion(): number {
  return useSyncExternalStore(subscribeCatalog, catalogVersion, catalogVersion);
}

export const furthestOf = (s: ReaderState, key: string): Position => s.furthest[key] ?? START;

export function useFurthest(key: string): Position {
  return useReader((s) => furthestOf(s, key));
}

export function useFragments(seriesId: string) {
  const furthest = useFurthest(seriesId);
  return fragmentProgress(allFragments.filter((f) => f.seriesId === seriesId), furthest);
}

export const embersOf = (s: ReaderState) => balance(s.rewards);
export const useEmbers = () => useReader(embersOf);

/** Access for a catalog chapter in this build's trust mode. */
export function accessOf(s: ReaderState, chapterId: string, now: number): AccessState {
  return resolveAccess({
    availability: availabilityFor(chapterId),
    policy: policyFor(chapterId),
    editions: editionsFor(chapterId),
    entitlements: s.commerce.entitlements,
    now,
    trusted: TRUST,
  });
}

export function useAccess(chapterId: string | undefined, now: number): AccessState | undefined {
  useCatalogVersion();
  const entitlements = useReader((s) => s.commerce.entitlements);
  if (!chapterId) return undefined;
  return resolveAccess({
    availability: availabilityFor(chapterId),
    policy: policyFor(chapterId),
    editions: editionsFor(chapterId),
    entitlements,
    now,
    trusted: TRUST,
  });
}

export type ContinueInfo = {
  chapter: Chapter;
  position: Position;
  progress: number;
  pageLabel: string;
};

/** Where to resume a series: the chapter in progress, else the first readable one. */
export function continueFor(s: ReaderState, seriesId: string): ContinueInfo | undefined {
  const list = chaptersOf(seriesId).filter((c) => c.pages.length > 0);
  if (list.length === 0) return undefined;
  const pos = s.current[seriesId];
  const chapter = (pos && list.find((c) => c.number === pos.chapter)) || list[0];
  const position = pos && pos.chapter === chapter.number ? pos : { chapter: chapter.number, page: 0, panel: 0 };
  return {
    chapter,
    position,
    progress: pos ? chapterProgress(chapter.pages, { page: position.page, panel: position.panel }) : 0,
    pageLabel: chapter.pages[position.page]?.label ?? '1',
  };
}

/** Progress through an imported comic, 0..1. */
export function localProgress(s: ReaderState, pub: LocalPublication): number {
  const f = s.furthest[localKey(pub.id)];
  if (!f || f.chapter < 0 || pub.pages.length === 0) return 0;
  return Math.min(1, (f.page + 1) / pub.pages.length);
}
