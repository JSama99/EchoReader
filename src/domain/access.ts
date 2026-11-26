import type { Chapter } from './types';

/**
 * Fair access rules.
 * - Every chapter becomes free for everyone at `freeAt` (≤ 24h after publish).
 * - Before that, a reader may spend one Ember to read it early.
 * - Embers are earned by reading, never sold behind waits: one per ISO week in
 *   which the reader finishes a chapter. They never expire.
 */

export const MAX_EARLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AccessState =
  | { kind: 'free' }
  | { kind: 'unlocked' }
  | { kind: 'early'; msUntilFree: number; canSpendEmber: boolean }
  | { kind: 'unreleased'; msUntilPublish: number };

export function accessFor(
  chapter: Chapter,
  now: number,
  unlockedChapterIds: ReadonlySet<string>,
  embers: number,
): AccessState {
  const publish = Date.parse(chapter.publishedAt);
  const free = Date.parse(chapter.freeAt);
  if (now >= free) return { kind: 'free' };
  if (unlockedChapterIds.has(chapter.id)) return { kind: 'unlocked' };
  if (now < publish) return { kind: 'unreleased', msUntilPublish: publish - now };
  return { kind: 'early', msUntilFree: free - now, canSpendEmber: embers > 0 };
}

export function canRead(state: AccessState): boolean {
  return state.kind === 'free' || state.kind === 'unlocked';
}

/** Validates catalog data: the early window may never exceed 24h. */
export function earlyWindowIsFair(chapter: Chapter): boolean {
  const window = Date.parse(chapter.freeAt) - Date.parse(chapter.publishedAt);
  return window >= 0 && window <= MAX_EARLY_WINDOW_MS;
}

export type SpendResult =
  | { ok: true; embers: number; unlocked: string[] }
  | { ok: false; reason: 'no-embers' | 'already-readable' | 'unreleased' };

export function spendEmber(
  chapter: Chapter,
  now: number,
  unlocked: readonly string[],
  embers: number,
): SpendResult {
  const state = accessFor(chapter, now, new Set(unlocked), embers);
  if (state.kind === 'free' || state.kind === 'unlocked') return { ok: false, reason: 'already-readable' };
  if (state.kind === 'unreleased') return { ok: false, reason: 'unreleased' };
  if (embers <= 0) return { ok: false, reason: 'no-embers' };
  return { ok: true, embers: embers - 1, unlocked: [...unlocked, chapter.id] };
}

/** ISO-8601 week key, e.g. "2026-W48". */
export function isoWeekKey(ts: number): string {
  const d = new Date(ts);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Award an Ember for finishing a chapter, at most once per ISO week.
 * Returns the new balance and the updated set of rewarded weeks.
 */
export function earnEmberForFinish(
  now: number,
  embers: number,
  rewardedWeeks: readonly string[],
): { embers: number; rewardedWeeks: string[]; awarded: boolean } {
  const key = isoWeekKey(now);
  if (rewardedWeeks.includes(key)) return { embers, rewardedWeeks: [...rewardedWeeks], awarded: false };
  return { embers: embers + 1, rewardedWeeks: [...rewardedWeeks, key], awarded: true };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
