/**
 * Privacy-conscious product analytics.
 *
 * - Off until the reader opts in (Profile → Privacy). Nothing is queued before that.
 * - No account ids, no device ids, no IP-derived data. A random session id per launch only.
 * - Imported comics are anonymous: never their titles, file names or ids,
 *   only the format and a coarse page-count bucket.
 * - Events produced by sandbox purchases or development builds carry
 *   `synthetic: true` so they can never be mistaken for real readership.
 */

export type AnalyticsEvent =
  | { name: 'app_open' }
  | { name: 'discover_open' }
  | { name: 'chapter_start'; publicationId: string; mode: string }
  | { name: 'chapter_complete'; publicationId: string }
  | { name: 'reading_session'; publicationId: string; seconds: number; mode: string }
  | { name: 'mode_change'; mode: string }
  | { name: 'preview_end'; publicationId: string }
  | { name: 'edition_view'; publicationId: string }
  | { name: 'edition_select'; publicationId: string; tier: string }
  | { name: 'purchase_start' | 'purchase_complete' | 'purchase_failed'; publicationId: string; tier: string }
  | { name: 'import_complete'; format: string; pages: number }
  | { name: 'import_failed'; code: string }
  | { name: 'local_read_start'; format: string }
  | { name: 'reward_earned'; trigger: string };

export type Envelope = {
  name: AnalyticsEvent['name'];
  props: Record<string, string | number>;
  at: string;
  session: string;
  synthetic: boolean;
};

export const pageBucket = (n: number) => (n <= 20 ? '1-20' : n <= 60 ? '21-60' : n <= 200 ? '61-200' : '200+');

/** Strip anything that could identify a reader's private files. */
export function sanitize(e: AnalyticsEvent): Record<string, string | number> {
  const { name: _, ...rest } = e as AnalyticsEvent & Record<string, unknown>;
  const props: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === 'publicationId' && typeof v === 'string' && v.startsWith('local:')) continue;
    if (k === 'pages' && typeof v === 'number') {
      props.pageBucket = pageBucket(v);
      continue;
    }
    if (k === 'seconds' && typeof v === 'number') {
      props.seconds = Math.min(4 * 3600, Math.max(0, Math.round(v)));
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number') props[k] = v;
  }
  return props;
}

export function envelope(e: AnalyticsEvent, ctx: { consent: boolean; session: string; synthetic: boolean; now: number }): Envelope | null {
  if (!ctx.consent) return null;
  return { name: e.name, props: sanitize(e), at: new Date(ctx.now).toISOString(), session: ctx.session, synthetic: ctx.synthetic };
}

/** Bounded in-memory queue: newest kept, oldest dropped. */
export function enqueue(queue: Envelope[], item: Envelope | null, max = 500): Envelope[] {
  if (!item) return queue;
  const next = [...queue, item];
  return next.length > max ? next.slice(next.length - max) : next;
}
