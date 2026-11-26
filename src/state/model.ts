import { applyTransaction } from '@/domain/commerce/ledger';
import { emptyLedger, type CommerceLedger, type Edition, type PurchaseTransaction } from '@/domain/commerce/types';
import type { Bookmark, Collection, HistoryEntry, LocalPublication } from '@/domain/library';
import { maxPosition, START } from '@/domain/position';
import { award, DEFAULT_RULES, dayKey, emptyRewards, redeem, type RedeemableItem, type RewardLedger } from '@/domain/rewards';
import type { Position, ReadingMode } from '@/domain/types';

/**
 * Reader state: everything persisted on device. A pure reducer, so every rule
 * about progress, rewards and purchases is unit-tested without React.
 */

export type ReaderTheme = 'dark' | 'light';
export type FitMode = 'page' | 'width' | 'height';
export type MotionPref = 'system' | 'reduce' | 'full';

export type ReaderState = {
  version: 2;
  onboarded: boolean;
  globalMode?: ReadingMode;
  seriesModes: Record<string, ReadingMode>;
  /** Furthest position ever reached, per series or imported comic. Drives the spoiler shield. */
  furthest: Record<string, Position>;
  /** Where the reader left off (can be behind `furthest`). */
  current: Record<string, Position>;
  /** When `current` last changed, for cross-device merging. */
  currentAt: Record<string, string>;
  finishedChapterIds: string[];
  /** Fragment moments already shown, so each plays exactly once. */
  celebratedFragmentIds: string[];
  discoveredGlyphIds: string[];
  following: string[];
  notifySeries: string[];
  favorites: string[];

  // Reading preferences
  echoEnabled: boolean;
  transition: 'glide' | 'cut';
  motion: MotionPref;
  readerTheme: ReaderTheme;
  fit: FitMode;

  // Library
  library: LocalPublication[];
  collections: Collection[];
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  readingDays: string[];

  // Rewards & commerce
  rewards: RewardLedger;
  commerce: CommerceLedger;
  achievements: { id: string; at: string }[];

  // Privacy
  analyticsConsent: boolean;
};

const WELCOME = { id: 'grant:welcome', ruleId: 'grant', key: 'welcome', amount: 1, at: '2026-01-01T00:00:00.000Z' };

export const initialState: ReaderState = {
  version: 2,
  onboarded: false,
  seriesModes: {},
  furthest: {},
  current: {},
  currentAt: {},
  finishedChapterIds: [],
  celebratedFragmentIds: [],
  discoveredGlyphIds: [],
  following: ['flame-sigil'],
  notifySeries: [],
  favorites: [],
  echoEnabled: true,
  transition: 'glide',
  motion: 'system',
  readerTheme: 'dark',
  fit: 'page',
  library: [],
  collections: [],
  bookmarks: [],
  history: [],
  readingDays: [],
  rewards: { events: [WELCOME], redemptions: [] },
  commerce: emptyLedger,
  achievements: [],
  analyticsConsent: false,
};

const HISTORY_MAX = 200;
const DAYS_MAX = 400;

export type SettingsPatch = Partial<
  Pick<ReaderState, 'echoEnabled' | 'transition' | 'motion' | 'readerTheme' | 'fit' | 'globalMode' | 'analyticsConsent'>
>;

export type Action =
  | { type: 'onboard'; mode: ReadingMode }
  | { type: 'resetOnboarding' }
  | { type: 'setMode'; seriesId: string; mode: ReadingMode; remember: boolean }
  | { type: 'advance'; seriesId: string; position: Position; now: number }
  | { type: 'finishChapter'; chapterId: string; now: number }
  | { type: 'discoverGlyph'; glyphId: string; now: number }
  | { type: 'celebrate'; fragmentId: string }
  | { type: 'toggleFollow'; seriesId: string }
  | { type: 'toggleNotify'; seriesId: string }
  | { type: 'toggleFavorite'; key: string }
  | { type: 'set'; patch: SettingsPatch }
  | { type: 'opened'; key: string; chapterId: string; now: number }
  | { type: 'toggleBookmark'; key: string; chapterId: string; page: number; now: number }
  | { type: 'removeBookmark'; id: string }
  | { type: 'addPublication'; publication: LocalPublication }
  | { type: 'updatePublication'; id: string; patch: Partial<Pick<LocalPublication, 'title' | 'author' | 'seriesName' | 'number' | 'direction' | 'coverPage'>> }
  | { type: 'removePublication'; id: string }
  | { type: 'createCollection'; id: string; name: string; now: number }
  | { type: 'renameCollection'; id: string; name: string }
  | { type: 'deleteCollection'; id: string }
  | { type: 'toggleInCollection'; collectionId: string; key: string }
  | { type: 'applyTransactions'; transactions: PurchaseTransaction[]; editions: Edition[] }
  | { type: 'redeem'; item: RedeemableItem; redemptionId: string; now: number; chapterAllowsEmbers?: boolean }
  | { type: 'unlockAchievement'; id: string; now: number }
  | { type: 'eraseAll' }
  | { type: 'hydrate'; state: ReaderState };

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function earn(state: ReaderState, trigger: Parameters<typeof award>[2], key: string, now: number): ReaderState {
  const r = award(state.rewards, DEFAULT_RULES, trigger, key, now);
  return r.awarded ? { ...state, rewards: r.ledger } : state;
}

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
      const day = dayKey(action.now);
      return {
        ...state,
        current: { ...state.current, [action.seriesId]: action.position },
        currentAt: { ...state.currentAt, [action.seriesId]: new Date(action.now).toISOString() },
        furthest: { ...state.furthest, [action.seriesId]: maxPosition(prev, action.position) },
        readingDays: state.readingDays.includes(day) ? state.readingDays : [...state.readingDays, day].slice(-DAYS_MAX),
      };
    }
    case 'finishChapter': {
      if (state.finishedChapterIds.includes(action.chapterId)) return state;
      const next = { ...state, finishedChapterIds: [...state.finishedChapterIds, action.chapterId] };
      // Imported comics are the reader's own files: finishing them is tracked but never rewarded.
      return action.chapterId.startsWith('local:') ? next : earn(next, 'chapter-complete', action.chapterId, action.now);
    }
    case 'discoverGlyph': {
      if (state.discoveredGlyphIds.includes(action.glyphId)) return state;
      return earn({ ...state, discoveredGlyphIds: [...state.discoveredGlyphIds, action.glyphId] }, 'glyph-discovered', action.glyphId, action.now);
    }
    case 'celebrate':
      return state.celebratedFragmentIds.includes(action.fragmentId)
        ? state
        : { ...state, celebratedFragmentIds: [...state.celebratedFragmentIds, action.fragmentId] };
    case 'toggleFollow':
      return { ...state, following: toggle(state.following, action.seriesId) };
    case 'toggleNotify':
      return { ...state, notifySeries: toggle(state.notifySeries, action.seriesId) };
    case 'toggleFavorite':
      return { ...state, favorites: toggle(state.favorites, action.key) };
    case 'set':
      return { ...state, ...action.patch };
    case 'opened': {
      const entry = { key: action.key, chapterId: action.chapterId, at: new Date(action.now).toISOString() };
      return { ...state, history: [entry, ...state.history.filter((h) => h.chapterId !== action.chapterId)].slice(0, HISTORY_MAX) };
    }
    case 'toggleBookmark': {
      const hit = state.bookmarks.find((b) => b.chapterId === action.chapterId && b.page === action.page);
      if (hit) return { ...state, bookmarks: state.bookmarks.filter((b) => b !== hit) };
      const b: Bookmark = {
        id: `${action.chapterId}#${action.page}`,
        key: action.key,
        chapterId: action.chapterId,
        page: action.page,
        createdAt: new Date(action.now).toISOString(),
      };
      return { ...state, bookmarks: [b, ...state.bookmarks] };
    }
    case 'removeBookmark':
      return { ...state, bookmarks: state.bookmarks.filter((b) => b.id !== action.id) };
    case 'addPublication':
      if (state.library.some((p) => p.id === action.publication.id)) return state;
      return { ...state, library: [action.publication, ...state.library] };
    case 'updatePublication':
      return { ...state, library: state.library.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'removePublication': {
      const key = `local:${action.id}`;
      const { [key]: _f, ...furthest } = state.furthest;
      const { [key]: _c, ...current } = state.current;
      const { [key]: _a, ...currentAt } = state.currentAt;
      return {
        ...state,
        library: state.library.filter((p) => p.id !== action.id),
        furthest,
        current,
        currentAt,
        favorites: state.favorites.filter((k) => k !== key),
        bookmarks: state.bookmarks.filter((b) => b.key !== key),
        history: state.history.filter((h) => h.key !== key),
        finishedChapterIds: state.finishedChapterIds.filter((id) => id !== key),
        collections: state.collections.map((c) => ({ ...c, itemKeys: c.itemKeys.filter((k) => k !== key) })),
      };
    }
    case 'createCollection': {
      const name = action.name.trim().slice(0, 60);
      if (!name || state.collections.some((c) => c.id === action.id)) return state;
      return { ...state, collections: [...state.collections, { id: action.id, name, createdAt: new Date(action.now).toISOString(), itemKeys: [] }] };
    }
    case 'renameCollection': {
      const name = action.name.trim().slice(0, 60);
      if (!name) return state;
      return { ...state, collections: state.collections.map((c) => (c.id === action.id ? { ...c, name } : c)) };
    }
    case 'deleteCollection':
      return { ...state, collections: state.collections.filter((c) => c.id !== action.id) };
    case 'toggleInCollection':
      return {
        ...state,
        collections: state.collections.map((c) => (c.id === action.collectionId ? { ...c, itemKeys: toggle(c.itemKeys, action.key) } : c)),
      };
    case 'applyTransactions': {
      let commerce = state.commerce;
      for (const tx of action.transactions) commerce = applyTransaction(commerce, tx, action.editions).ledger;
      return commerce === state.commerce ? state : { ...state, commerce };
    }
    case 'redeem': {
      const r = redeem(state.rewards, action.item, action.redemptionId, action.now, action.chapterAllowsEmbers);
      return r.ok ? { ...state, rewards: r.ledger } : state;
    }
    case 'unlockAchievement': {
      if (state.achievements.some((a) => a.id === action.id)) return state;
      const next = { ...state, achievements: [...state.achievements, { id: action.id, at: new Date(action.now).toISOString() }] };
      return earn(next, 'achievement', action.id, action.now);
    }
    case 'eraseAll':
      return { ...initialState, onboarded: false };
    case 'hydrate':
      return migrate(action.state);
  }
}

// ── Migration ───────────────────────────────────────────────────────────────

type V1 = {
  version: 1;
  onboarded?: boolean;
  globalMode?: ReadingMode;
  seriesModes?: Record<string, ReadingMode>;
  furthest?: Record<string, Position>;
  current?: Record<string, Position>;
  embers?: number;
  rewardedWeeks?: string[];
  unlockedChapterIds?: string[];
  finishedChapterIds?: string[];
  celebratedFragmentIds?: string[];
  following?: string[];
  notifySeries?: string[];
  echoEnabled?: boolean;
  transition?: 'glide' | 'cut';
};

/** Monday 00:00 UTC of an ISO week key ("2026-W48"). */
export function isoWeekStart(key: string): string {
  const [y, w] = key.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (day - 1) * 86400000 + (w - 1) * 7 * 86400000);
  return monday.toISOString();
}

/**
 * v1 → v2. The Ember balance carries over exactly. The 24-hour early-access
 * model no longer exists, so every Ember spent on early access is returned.
 * Rewarded weeks are kept as zero-value markers so the one-per-week rule
 * still holds for the week the reader migrates in.
 */
export function migrateV1(r: V1): ReaderState {
  const balance = Math.max(0, Math.floor(r.embers ?? 0));
  const events: RewardLedger['events'] = [];
  if (balance > 0) events.push({ id: 'legacy:v1-balance', ruleId: 'legacy', key: 'v1-balance', amount: balance, at: '2026-01-01T00:00:00.000Z' });
  for (const id of r.unlockedChapterIds ?? []) {
    events.push({ id: `legacy:refund:${id}`, ruleId: 'legacy', key: `refund:${id}`, amount: 1, at: '2026-01-01T00:00:00.000Z' });
  }
  for (const wk of r.rewardedWeeks ?? []) {
    if (/^\d{4}-W\d{2}$/.test(wk)) {
      events.push({ id: `chapter-complete:legacy-${wk}`, ruleId: 'chapter-complete', key: `legacy-${wk}`, amount: 0, at: isoWeekStart(wk) });
    }
  }
  return {
    ...initialState,
    onboarded: !!r.onboarded,
    globalMode: r.globalMode,
    seriesModes: r.seriesModes ?? {},
    furthest: r.furthest ?? {},
    current: r.current ?? {},
    finishedChapterIds: r.finishedChapterIds ?? [],
    celebratedFragmentIds: r.celebratedFragmentIds ?? [],
    following: r.following ?? initialState.following,
    notifySeries: r.notifySeries ?? [],
    echoEnabled: r.echoEnabled ?? true,
    transition: r.transition ?? 'glide',
    rewards: { events, redemptions: [] },
  };
}

/** Accepts anything from storage and returns a valid current state. */
export function migrate(raw: unknown): ReaderState {
  if (!raw || typeof raw !== 'object') return initialState;
  const r = raw as { version?: unknown };
  if (r.version === 1) return migrateV1(raw as V1);
  if (r.version !== 2) return initialState;
  const s = raw as Partial<ReaderState>;
  return {
    ...initialState,
    ...s,
    rewards: s.rewards && Array.isArray(s.rewards.events) ? s.rewards : emptyRewards,
    commerce: s.commerce && Array.isArray(s.commerce.transactions) ? s.commerce : emptyLedger,
    version: 2,
  };
}
