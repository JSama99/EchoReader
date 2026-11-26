/**
 * Embers: a non-transferable, off-chain engagement reward.
 *
 * Embers are not money, cryptocurrency or an investment. They cannot be sent
 * to another reader, sold, or redeemed for cash. They are earned through
 * configurable rules and spent only on items a publisher explicitly offers.
 *
 * The balance is never stored on its own: it is derived from an append-only
 * event log, and every award carries an idempotency key so retries, replays
 * and device sync can never double-award.
 */

export type RewardTrigger =
  | 'chapter-complete'
  | 'reading-streak'
  | 'glyph-discovered'
  | 'lore-challenge'
  | 'collection-complete'
  | 'community'
  | 'achievement';

export type RewardRule = {
  id: string;
  trigger: RewardTrigger;
  amount: number;
  /** At most one award per subject key (e.g. per chapter, per glyph). */
  oncePerKey: boolean;
  /** Optional caps across all keys of this rule. */
  maxPerIsoWeek?: number;
  maxPerDay?: number;
  enabled: boolean;
};

export type RewardEvent = {
  /** Idempotency key: `${ruleId}:${key}`. */
  id: string;
  ruleId: string;
  key: string;
  amount: number;
  at: string;
};

export type RedemptionKind = 'artwork' | 'fragment' | 'badge' | 'profile' | 'bonus' | 'promotion' | 'chapter-unlock';

export type RedeemableItem = {
  id: string;
  kind: RedemptionKind;
  title: string;
  cost: number;
  /** For 'chapter-unlock' only; the chapter's policy must also allow it. */
  chapterId?: string;
};

export type Redemption = { id: string; itemId: string; cost: number; at: string };

export type RewardLedger = { events: RewardEvent[]; redemptions: Redemption[] };

export const emptyRewards: RewardLedger = { events: [], redemptions: [] };

/**
 * Default rules. Chapter completion keeps the v0.1 behavior exactly: one
 * Ember per ISO week in which the reader finishes a chapter, never twice for
 * the same chapter.
 */
export const DEFAULT_RULES: RewardRule[] = [
  { id: 'chapter-complete', trigger: 'chapter-complete', amount: 1, oncePerKey: true, maxPerIsoWeek: 1, enabled: true },
  { id: 'glyph-discovered', trigger: 'glyph-discovered', amount: 1, oncePerKey: true, maxPerDay: 3, enabled: true },
  { id: 'streak-7', trigger: 'reading-streak', amount: 2, oncePerKey: true, enabled: true },
  { id: 'collection-complete', trigger: 'collection-complete', amount: 3, oncePerKey: true, enabled: true },
  { id: 'lore-challenge', trigger: 'lore-challenge', amount: 2, oncePerKey: true, enabled: false },
  { id: 'community', trigger: 'community', amount: 1, oncePerKey: true, maxPerIsoWeek: 2, enabled: false },
  { id: 'achievement', trigger: 'achievement', amount: 1, oncePerKey: true, enabled: true },
];

export function balance(l: RewardLedger): number {
  const earned = l.events.reduce((n, e) => n + e.amount, 0);
  const spent = l.redemptions.reduce((n, r) => n + r.cost, 0);
  return earned - spent;
}

/** ISO-8601 week key in UTC, e.g. "2026-W48". */
export function isoWeekKey(ts: number): string {
  const d = new Date(ts);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

export type AwardResult =
  | { awarded: true; ledger: RewardLedger; event: RewardEvent }
  | { awarded: false; ledger: RewardLedger; reason: 'no-rule' | 'disabled' | 'duplicate' | 'weekly-cap' | 'daily-cap' };

export function award(
  ledger: RewardLedger,
  rules: readonly RewardRule[],
  trigger: RewardTrigger,
  key: string,
  now: number,
): AwardResult {
  const rule = rules.find((r) => r.trigger === trigger);
  if (!rule) return { awarded: false, ledger, reason: 'no-rule' };
  if (!rule.enabled || rule.amount <= 0) return { awarded: false, ledger, reason: 'disabled' };

  const id = rule.oncePerKey ? `${rule.id}:${key}` : `${rule.id}:${key}:${now}`;
  if (ledger.events.some((e) => e.id === id)) return { awarded: false, ledger, reason: 'duplicate' };

  const mine = ledger.events.filter((e) => e.ruleId === rule.id);
  if (rule.maxPerIsoWeek != null) {
    const week = isoWeekKey(now);
    if (mine.filter((e) => isoWeekKey(Date.parse(e.at)) === week).length >= rule.maxPerIsoWeek) {
      return { awarded: false, ledger, reason: 'weekly-cap' };
    }
  }
  if (rule.maxPerDay != null) {
    const day = dayKey(now);
    if (mine.filter((e) => dayKey(Date.parse(e.at)) === day).length >= rule.maxPerDay) {
      return { awarded: false, ledger, reason: 'daily-cap' };
    }
  }

  const event: RewardEvent = { id, ruleId: rule.id, key, amount: rule.amount, at: new Date(now).toISOString() };
  return { awarded: true, ledger: { ...ledger, events: [...ledger.events, event] }, event };
}

export type RedeemResult =
  | { ok: true; ledger: RewardLedger }
  | { ok: false; ledger: RewardLedger; reason: 'insufficient' | 'duplicate' | 'not-allowed' };

/**
 * Spend Embers on a publisher-offered item. `redemptionId` is the idempotency
 * key. Chapter unlocks require the chapter's own policy to opt in.
 */
export function redeem(
  ledger: RewardLedger,
  item: RedeemableItem,
  redemptionId: string,
  now: number,
  chapterAllowsEmbers = false,
): RedeemResult {
  if (ledger.redemptions.some((r) => r.id === redemptionId)) return { ok: false, ledger, reason: 'duplicate' };
  if (item.kind === 'chapter-unlock' && !chapterAllowsEmbers) return { ok: false, ledger, reason: 'not-allowed' };
  if (balance(ledger) < item.cost) return { ok: false, ledger, reason: 'insufficient' };
  return {
    ok: true,
    ledger: { ...ledger, redemptions: [...ledger.redemptions, { id: redemptionId, itemId: item.id, cost: item.cost, at: new Date(now).toISOString() }] },
  };
}

/** Merge two ledgers from different devices: union by id. */
export function mergeRewards(a: RewardLedger, b: RewardLedger): RewardLedger {
  const events = new Map(a.events.map((e) => [e.id, e]));
  b.events.forEach((e) => events.has(e.id) || events.set(e.id, e));
  const redemptions = new Map(a.redemptions.map((r) => [r.id, r]));
  b.redemptions.forEach((r) => redemptions.has(r.id) || redemptions.set(r.id, r));
  return {
    events: [...events.values()].sort((x, y) => x.at.localeCompare(y.at)),
    redemptions: [...redemptions.values()].sort((x, y) => x.at.localeCompare(y.at)),
  };
}

/**
 * Consecutive UTC days with reading activity, ending today or yesterday.
 * `days` are "YYYY-MM-DD" keys.
 */
export function readingStreak(days: readonly string[], now: number): number {
  const set = new Set(days);
  const one = 86_400_000;
  let cursor = set.has(dayKey(now)) ? now : now - one;
  let n = 0;
  while (set.has(dayKey(cursor))) {
    n++;
    cursor -= one;
  }
  return n;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  return d > 0 ? `${d}d ${hms}` : hms;
}
