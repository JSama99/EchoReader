/**
 * Server-side page authorization for paid content. Self-contained (no
 * imports) so it runs unchanged in Deno edge functions and in Jest, where a
 * parity test checks it against the app's resolveAccess for every case.
 *
 * The client's own access check is a convenience; this is the enforcement.
 */

export type ServerPublication = {
  id: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived' | 'unavailable';
  releaseAt: string | null;
  accessBase: 'free' | 'paid';
  previewPages: number;
  pageCount: number;
};

export type ServerEntitlement = {
  publicationId: string;
  source: 'purchase' | 'subscription' | 'promotion' | 'reward' | 'grant';
  status: 'active' | 'refunded' | 'revoked' | 'expired';
  verification: 'store-verified' | 'server-verified' | 'sandbox';
  expiresAt: string | null;
};

export type ServerPromotion = { publicationId: string; startsAt: string; endsAt: string };

export type PageGrant = { allowed: 'all' | 'preview' | 'none'; pages: number[]; reason: string };

export function authorizePages(input: {
  publication: ServerPublication | null;
  entitlements: ServerEntitlement[];
  promotions: ServerPromotion[];
  now: number;
  /** Production must pass false: sandbox purchases never unlock real content. */
  acceptSandbox: boolean;
}): PageGrant {
  const p = input.publication;
  if (!p) return { allowed: 'none', pages: [], reason: 'not-found' };
  const released = p.status === 'published' || p.status === 'archived' || (p.status === 'scheduled' && !!p.releaseAt && Date.parse(p.releaseAt) <= input.now);
  if (!released) return { allowed: 'none', pages: [], reason: p.status };

  const all = Array.from({ length: p.pageCount }, (_, i) => i);
  const owned = input.entitlements.some(
    (e) =>
      e.publicationId === p.id &&
      e.status === 'active' &&
      (e.verification !== 'sandbox' || input.acceptSandbox) &&
      (!e.expiresAt || Date.parse(e.expiresAt) > input.now),
  );
  if (owned) return { allowed: 'all', pages: all, reason: 'entitled' };
  if (p.status === 'archived') return { allowed: 'none', pages: [], reason: 'archived' };
  if (p.accessBase === 'free') return { allowed: 'all', pages: all, reason: 'free' };
  const promo = input.promotions.some((x) => x.publicationId === p.id && Date.parse(x.startsAt) <= input.now && input.now < Date.parse(x.endsAt));
  if (promo) return { allowed: 'all', pages: all, reason: 'promotion' };
  if (p.previewPages > 0) return { allowed: 'preview', pages: all.slice(0, p.previewPages), reason: 'preview' };
  return { allowed: 'none', pages: [], reason: 'paid' };
}
