import type { AccessPolicy, Availability, Edition, Entitlement, Verification } from './types';

/**
 * Resolves what a reader may do with one publication right now.
 *
 * Order of evaluation:
 *   1. Availability (draft / scheduled / archived / unavailable) gates everything.
 *   2. An active entitlement (purchase > subscription > promotion > reward > grant).
 *   3. The publisher's access policy (free, active promotion, preview, paid).
 *
 * There is no automatic free-after-N-hours rule: a paid chapter stays paid
 * until the publisher changes its policy or runs a promotion.
 */

export type AccessState =
  | { kind: 'free' }
  | { kind: 'promotional'; label: string; endsAt?: string }
  | { kind: 'purchased'; editionId?: string }
  | { kind: 'collectible'; editionId: string }
  | { kind: 'subscription' }
  | { kind: 'preview'; previewPages: number; editions: Edition[] }
  | { kind: 'paid'; editions: Edition[] }
  | { kind: 'scheduled'; releaseAt: string }
  | { kind: 'unpublished' }
  | { kind: 'unavailable'; reason: 'withdrawn' | 'archived' | 'region' | 'unknown' };

export type AccessInput = {
  availability: Availability | undefined;
  policy: AccessPolicy | undefined;
  editions: Edition[];
  entitlements: readonly Entitlement[];
  now: number;
  /**
   * Which verification levels count. Production builds accept only store- and
   * server-verified entitlements; sandbox builds also accept sandbox ones.
   */
  trusted: readonly Verification[];
};

export const PRODUCTION_TRUST: readonly Verification[] = ['store-verified', 'server-verified'];
export const SANDBOX_TRUST: readonly Verification[] = ['store-verified', 'server-verified', 'sandbox', 'local'];

const SOURCE_RANK: Record<Entitlement['source'], number> = {
  purchase: 0,
  subscription: 1,
  promotion: 2,
  reward: 3,
  grant: 4,
};

export function activeEntitlements(
  chapterId: string,
  entitlements: readonly Entitlement[],
  now: number,
  trusted: readonly Verification[],
): Entitlement[] {
  return entitlements
    .filter(
      (e) =>
        e.chapterId === chapterId &&
        e.status === 'active' &&
        trusted.includes(e.verification) &&
        (!e.expiresAt || Date.parse(e.expiresAt) > now),
    )
    .sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
}

/** The effective availability status at `now` (a passed schedule is published). */
export function effectiveStatus(a: Availability | undefined, now: number): Availability['status'] {
  if (!a) return 'unavailable';
  if (a.status === 'scheduled' && a.releaseAt && Date.parse(a.releaseAt) <= now) return 'published';
  return a.status;
}

export function resolveAccess(input: AccessInput): AccessState {
  const { availability, policy, editions, now } = input;
  const status = effectiveStatus(availability, now);
  const chapterId = availability?.chapterId ?? policy?.chapterId ?? '';
  const owned = activeEntitlements(chapterId, input.entitlements, now, input.trusted);

  if (status === 'draft') return { kind: 'unpublished' };
  if (status === 'scheduled') {
    return availability?.releaseAt ? { kind: 'scheduled', releaseAt: availability.releaseAt } : { kind: 'unpublished' };
  }
  if (status === 'unavailable') return { kind: 'unavailable', reason: availability ? 'withdrawn' : 'unknown' };
  // Archived: readers who already hold the chapter keep it; nobody new can get it.
  if (status === 'archived' && owned.length === 0) return { kind: 'unavailable', reason: 'archived' };

  const best = owned[0];
  if (best) {
    if (best.source === 'purchase') {
      const edition = editions.find((e) => e.id === best.editionId);
      return edition?.collectible ? { kind: 'collectible', editionId: edition.id } : { kind: 'purchased', editionId: best.editionId };
    }
    if (best.source === 'subscription') return { kind: 'subscription' };
    if (best.source === 'reward') return { kind: 'promotional', label: 'Unlocked with Embers' };
    if (best.source === 'promotion') return { kind: 'promotional', label: 'Promotional access', endsAt: best.expiresAt };
    return { kind: 'purchased' };
  }

  if (!policy) return { kind: 'unavailable', reason: 'unknown' };
  if (status === 'archived') return { kind: 'unavailable', reason: 'archived' };
  if (policy.base === 'free') return { kind: 'free' };

  const promo = policy.promotions.find((p) => Date.parse(p.startsAt) <= now && now < Date.parse(p.endsAt));
  if (promo) return { kind: 'promotional', label: promo.label, endsAt: promo.endsAt };

  const forSale = editions.filter((e) => e.onSale && e.chapterId === chapterId);
  if (policy.previewPages > 0) return { kind: 'preview', previewPages: policy.previewPages, editions: forSale };
  return { kind: 'paid', editions: forSale };
}

/** True when every page may be read. */
export function canReadFully(a: AccessState): boolean {
  return a.kind === 'free' || a.kind === 'promotional' || a.kind === 'purchased' || a.kind === 'collectible' || a.kind === 'subscription';
}

/** How many leading pages of a chapter with `pageCount` pages may be shown. */
export function readablePageCount(a: AccessState, pageCount: number): number {
  if (canReadFully(a)) return pageCount;
  if (a.kind === 'preview') return Math.min(pageCount, Math.max(0, a.previewPages));
  return 0;
}

/** Can the reader open the reader at all (full or preview)? */
export function canOpen(a: AccessState, pageCount: number): boolean {
  return readablePageCount(a, pageCount) > 0;
}

export const ACCESS_LABEL: Record<AccessState['kind'], string> = {
  free: 'Free',
  promotional: 'Free for a limited time',
  purchased: 'Purchased',
  collectible: 'Collector edition',
  subscription: 'Included with subscription',
  preview: 'Preview',
  paid: 'Paid',
  scheduled: 'Scheduled',
  unpublished: 'Not yet published',
  unavailable: 'Unavailable',
};
