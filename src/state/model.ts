import { earnEmberForFinish, spendEmber } from '@/domain/access';
import { maxPosition, START } from '@/domain/position';
import type { Chapter, Position, ReadingMode } from '@/domain/types';

/**
 * Reader state: everything persisted on device. Pure reducer, so every rule
 * about progress and Embers is unit-tested without React.
 */
export type ReaderState = {
  version: 1;
  onboarded: boolean;
  globalMode?: ReadingMode;
  seriesModes: Record<string, ReadingMode>;
  /** Furthest position ever reached, per series. Drives the spoiler shield. */
  furthest: Record<string, Position>;
  /** Where the reader left off, per series (can be behind `furthest`). */
  current: Record<string, Position>;
  embers: number;
  rewardedWeeks: string[];
  unlockedChapterIds: string[];
  finishedChapterIds: string[];
  /** Fragment moments already shown, so each plays exactly once. */
  celebratedFragmentIds: string[];
  following: string[];
  notifySeries: string[];
  echoEnabled: boolean;
  transition: 'glide' | 'cut';
  scoreEnabled: boolean;
  clearAfterDays: 0 | 1 | 7 | null;
  keepNextChapters: boolean;
};

export const initialState: ReaderState = {
  version: 1,
  onboarded: false,
  seriesModes: {},
  furthest: {},
  current: {},
  embers: 1,
  rewardedWeeks: [],
  unlockedChapterIds: [],
  finishedChapterIds: [],
  celebratedFragmentIds: [],
  following: ['flame-sigil'],
  notifySeries: [],
  echoEnabled: true,
  transition: 'glide',
  scoreEnabled: false,
  clearAfterDays: 7,
  keepNextChapters: true,
};

export type Action =
  | { type: 'onboard'; mode: ReadingMode }
  | { type: 'resetOnboarding' }
  | { type: 'setMode'; seriesId: string; mode: ReadingMode; remember: boolean }
  | { type: 'advance'; seriesId: string; position: Position }
  | { type: 'finishChapter'; chapterId: string; now: number }
  | { type: 'spendEmber'; chapter: Chapter; now: number }
  | { type: 'celebrate'; fragmentId: string }
  | { type: 'toggleFollow'; seriesId: string }
  | { type: 'toggleNotify'; seriesId: string }
  | { type: 'set'; patch: Partial<Pick<ReaderState, 'echoEnabled' | 'transition' | 'scoreEnabled' | 'clearAfterDays' | 'keepNextChapters' | 'globalMode'>> }
  | { type: 'hydrate'; state: ReaderState };

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export function reduce(state: ReaderState, action: Action): ReaderState {
  switch (action.type) {
    case 'onboard':
      return { ...state, onboarded: true, globalMode: action.mode };
    case 'resetOnboarding':
      return { ...state, onboarded: false };
    case 'setMode': {
      if (!action.remember) {
        const { [action.seriesId]: _, ...rest } = state.seriesModes;
        return { ...state, seriesModes: rest, globalMode: action.mode };
      }
      return { ...state, seriesModes: { ...state.seriesModes, [action.seriesId]: action.mode } };
    }
    case 'advance': {
      const prev = state.furthest[action.seriesId] ?? START;
      return {
        ...state,
        current: { ...state.current, [action.seriesId]: action.position },
        furthest: { ...state.furthest, [action.seriesId]: maxPosition(prev, action.position) },
      };
    }
    case 'finishChapter': {
      if (state.finishedChapterIds.includes(action.chapterId)) return state;
      const earned = earnEmberForFinish(action.now, state.embers, state.rewardedWeeks);
      return {
        ...state,
        finishedChapterIds: [...state.finishedChapterIds, action.chapterId],
        embers: earned.embers,
        rewardedWeeks: earned.rewardedWeeks,
      };
    }
    case 'spendEmber': {
      const r = spendEmber(action.chapter, action.now, state.unlockedChapterIds, state.embers);
      if (!r.ok) return state;
      return { ...state, embers: r.embers, unlockedChapterIds: r.unlocked };
    }
    case 'celebrate':
      return state.celebratedFragmentIds.includes(action.fragmentId)
        ? state
        : { ...state, celebratedFragmentIds: [...state.celebratedFragmentIds, action.fragmentId] };
    case 'toggleFollow':
      return { ...state, following: toggle(state.following, action.seriesId) };
    case 'toggleNotify':
      return { ...state, notifySeries: toggle(state.notifySeries, action.seriesId) };
    case 'set':
      return { ...state, ...action.patch };
    case 'hydrate':
      return migrate(action.state);
  }
}

/** Accepts anything from storage and returns a valid state (forward-compatible). */
export function migrate(raw: unknown): ReaderState {
  if (!raw || typeof raw !== 'object') return initialState;
  const r = raw as Partial<ReaderState>;
  if (r.version !== 1) return initialState;
  return { ...initialState, ...r };
}
