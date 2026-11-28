import {
  canOpen,
  canReadFully,
  PRODUCTION_TRUST,
  readablePageCount,
  resolveAccess,
  SANDBOX_TRUST,
  type AccessInput,
} from '@/domain/commerce/access';
import {
  applyTransaction,
  collectibleTrust,
  formatMoney,
  isVerifiedOwnership,
  nextSerial,
  restoreTransactions,
} from '@/domain/commerce/ledger';
import { emptyLedger, type Collectible, type Edition, type Entitlement, type PurchaseTransaction } from '@/domain/commerce/types';
import { award, balance, DEFAULT_RULES, emptyRewards, mergeRewards, readingStreak, redeem, type RewardRule } from '@/domain/rewards';

const NOW = Date.parse('2026-12-01T12:00:00Z');
const usd = (c: number) => ({ amountMinor: c, currency: 'USD' });

const edition = (tier: Edition['tier'], over: Partial<Edition> = {}): Edition => ({
  id: `c2-${tier}`,
  chapterId: 'c2',
  tier,
  title: tier,
  price: usd(tier === 'standard' ? 499 : tier === 'collector' ? 999 : 1999),
  productIds: {},
  benefits: [],
  includesReading: true,
  collectible: tier === 'standard' ? null : { kind: 'numbered', supply: tier === 'legendary' ? 100 : null, standard: 'erc721' },
  onSale: true,
  ...over,
});
const editions = [edition('standard'), edition('collector'), edition('legendary')];

const base = (over: Partial<AccessInput> = {}): AccessInput => ({
  availability: { chapterId: 'c2', status: 'published' },
  policy: { chapterId: 'c2', base: 'paid', previewPages: 3, promotions: [], subscriptionEligible: false },
  editions,
  entitlements: [],
  now: NOW,
  trusted: PRODUCTION_TRUST,
  ...over,
});

const ent = (over: Partial<Entitlement>): Entitlement => ({
  id: 'e',
  chapterId: 'c2',
  source: 'purchase',
  status: 'active',
  grantedAt: '2026-11-30T00:00:00Z',
  verification: 'store-verified',
  ...over,
});

describe('publisher-controlled access', () => {
  it('free chapters are free; paid chapters never turn free on their own', () => {
    expect(resolveAccess(base({ policy: { chapterId: 'c2', base: 'free', previewPages: 0, promotions: [], subscriptionEligible: false } })).kind).toBe('free');
    const years = base({ now: NOW + 5 * 365 * 86400_000 });
    expect(resolveAccess(years).kind).toBe('preview');
  });

  it('paid with a preview exposes only the preview pages and the editions on sale', () => {
    const a = resolveAccess(base({ editions: [...editions, edition('standard', { id: 'off', onSale: false })] }));
    expect(a.kind).toBe('preview');
    expect(readablePageCount(a, 20)).toBe(3);
    expect(readablePageCount(a, 2)).toBe(2);
    expect(a.kind === 'preview' && a.editions.map((e) => e.tier)).toEqual(['standard', 'collector', 'legendary']);
    expect(canReadFully(a)).toBe(false);
  });

  it('paid without a preview cannot be opened', () => {
    const a = resolveAccess(base({ policy: { chapterId: 'c2', base: 'paid', previewPages: 0, promotions: [], subscriptionEligible: false } }));
    expect(a.kind).toBe('paid');
    expect(canOpen(a, 20)).toBe(false);
  });

  it('a purchase of any edition grants the full chapter; collector editions report as collectible', () => {
    const std = resolveAccess(base({ entitlements: [ent({ editionId: 'c2-standard' })] }));
    expect(std).toEqual({ kind: 'purchased', editionId: 'c2-standard' });
    const col = resolveAccess(base({ entitlements: [ent({ editionId: 'c2-legendary' })] }));
    expect(col).toEqual({ kind: 'collectible', editionId: 'c2-legendary' });
    expect(readablePageCount(col, 20)).toBe(20);
  });

  it('honors sandbox entitlements only in sandbox builds', () => {
    const sandbox = [ent({ verification: 'sandbox' })];
    expect(resolveAccess(base({ entitlements: sandbox })).kind).toBe('preview');
    expect(resolveAccess(base({ entitlements: sandbox, trusted: SANDBOX_TRUST })).kind).toBe('purchased');
  });

  it('ignores refunded, revoked, expired and other-chapter entitlements', () => {
    const list = [
      ent({ id: '1', status: 'refunded' }),
      ent({ id: '2', status: 'revoked' }),
      ent({ id: '3', source: 'promotion', expiresAt: '2026-11-30T00:00:00Z' }),
      ent({ id: '4', chapterId: 'other' }),
    ];
    expect(resolveAccess(base({ entitlements: list })).kind).toBe('preview');
  });

  it('purchase outranks subscription and promotion', () => {
    const a = resolveAccess(base({ entitlements: [ent({ id: 's', source: 'subscription' }), ent({ id: 'p', editionId: 'c2-standard' })] }));
    expect(a.kind).toBe('purchased');
    expect(resolveAccess(base({ entitlements: [ent({ source: 'subscription' })] })).kind).toBe('subscription');
  });

  it('runs a promotion only inside its window', () => {
    const promo = { id: 'p', kind: 'free' as const, label: 'Free weekend', startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-03T00:00:00Z' };
    const policy = { chapterId: 'c2', base: 'paid' as const, previewPages: 0, promotions: [promo], subscriptionEligible: false };
    expect(resolveAccess(base({ policy }))).toEqual({ kind: 'promotional', label: 'Free weekend', endsAt: promo.endsAt });
    expect(resolveAccess(base({ policy, now: Date.parse('2026-12-03T00:00:00Z') })).kind).toBe('paid');
  });

  it('availability gates everything: draft, scheduled, archived, unavailable', () => {
    expect(resolveAccess(base({ availability: { chapterId: 'c2', status: 'draft' }, entitlements: [ent({})] })).kind).toBe('unpublished');
    const sched = { chapterId: 'c2', status: 'scheduled' as const, releaseAt: '2026-12-05T14:00:00Z' };
    expect(resolveAccess(base({ availability: sched }))).toEqual({ kind: 'scheduled', releaseAt: sched.releaseAt });
    expect(resolveAccess(base({ availability: sched, now: Date.parse(sched.releaseAt) })).kind).toBe('preview');
    expect(resolveAccess(base({ availability: { chapterId: 'c2', status: 'scheduled' } })).kind).toBe('unpublished');
    expect(resolveAccess(base({ availability: { chapterId: 'c2', status: 'archived' } }))).toEqual({ kind: 'unavailable', reason: 'archived' });
    expect(resolveAccess(base({ availability: { chapterId: 'c2', status: 'archived' }, entitlements: [ent({})] })).kind).toBe('purchased');
    expect(resolveAccess(base({ availability: undefined })).kind).toBe('unavailable');
  });

  it('collectible ownership alone never grants reading', () => {
    // Collectibles are not inputs to access at all: only entitlements are.
    const a = resolveAccess(base({ entitlements: [] }));
    expect(canReadFully(a)).toBe(false);
  });
});

const tx = (over: Partial<PurchaseTransaction>): PurchaseTransaction => ({
  id: 'tx-1',
  productId: 'p',
  editionId: 'c2-collector',
  chapterId: 'c2',
  status: 'completed',
  amount: usd(999),
  createdAt: '2026-12-01T00:00:00Z',
  updatedAt: '2026-12-01T00:00:00Z',
  environment: 'production',
  verification: 'store-verified',
  ...over,
});

describe('purchase ledger', () => {
  it('completing a collector purchase grants reading and reserves (not mints) a collectible', () => {
    const { ledger, changed } = applyTransaction(emptyLedger, tx({}), editions);
    expect(changed).toBe(true);
    expect(ledger.entitlements).toEqual([expect.objectContaining({ id: 'ent:tx-1', source: 'purchase', editionId: 'c2-collector' })]);
    expect(ledger.collectibles).toEqual([expect.objectContaining({ id: 'col:tx-1', status: 'reserved' })]);
    expect(ledger.collectibles[0].serial).toBeUndefined();
    expect(isVerifiedOwnership(ledger.collectibles[0])).toBe(false);
  });

  it('is idempotent: replaying the same transaction changes nothing', () => {
    const once = applyTransaction(emptyLedger, tx({}), editions).ledger;
    const twice = applyTransaction(once, tx({}), editions);
    expect(twice.changed).toBe(false);
    expect(twice.ignored).toBe('duplicate');
    expect(restoreTransactions(once, [tx({}), tx({}), tx({})], editions)).toEqual(once);
  });

  it('moves statuses only forward', () => {
    const pending = applyTransaction(emptyLedger, tx({ status: 'pending' }), editions).ledger;
    expect(pending.entitlements).toEqual([]);
    const done = applyTransaction(pending, tx({ status: 'completed' }), editions).ledger;
    expect(done.entitlements).toHaveLength(1);
    expect(applyTransaction(done, tx({ status: 'pending' }), editions).ignored).toBe('invalid-transition');
    const failed = applyTransaction(pending, tx({ status: 'failed' }), editions).ledger;
    expect(applyTransaction(failed, tx({ status: 'completed' }), editions).ignored).toBe('invalid-transition');
  });

  it('refunds revoke reading and release an unminted reservation', () => {
    const done = applyTransaction(emptyLedger, tx({}), editions).ledger;
    const refunded = applyTransaction(done, tx({ status: 'refunded', updatedAt: '2026-12-02T00:00:00Z' }), editions).ledger;
    expect(refunded.entitlements[0].status).toBe('refunded');
    expect(refunded.collectibles).toEqual([]);
    expect(resolveAccess(base({ entitlements: refunded.entitlements })).kind).toBe('preview');
  });

  it('rejects transactions for unknown or mismatched editions', () => {
    expect(applyTransaction(emptyLedger, tx({ editionId: 'nope' }), editions).ignored).toBe('unknown-edition');
    expect(applyTransaction(emptyLedger, tx({ chapterId: 'c9' }), editions).ignored).toBe('unknown-edition');
  });

  it('allocates numbered serials up to the supply', () => {
    const owned = (serial: number): Collectible => ({ id: `c${serial}`, editionId: 'L', chapterId: 'c2', serial, status: 'reserved', environment: 'production' });
    expect(nextSerial([], 'L', 2)).toBe(1);
    expect(nextSerial([owned(1)], 'L', 2)).toBe(2);
    expect(nextSerial([owned(1), owned(2)], 'L', 2)).toBeNull();
    expect(nextSerial([owned(1), owned(2)], 'L', null)).toBe(3);
  });

  it('labels every collectible honestly', () => {
    const c: Collectible = { id: 'x', editionId: 'L', chapterId: 'c2', status: 'reserved', environment: 'production' };
    expect(collectibleTrust(c).label).toBe('Reserved');
    expect(collectibleTrust({ ...c, environment: 'sandbox' }).label).toBe('Sandbox');
    expect(collectibleTrust({ ...c, status: 'demo' }).label).toBe('Demo');
    // "verified" without a complete chain record is downgraded.
    expect(collectibleTrust({ ...c, status: 'verified' }).label).toBe('Awaiting verification');
    const chain = { network: 'base', standard: 'erc721' as const, contract: '0xabc', tokenId: '7', txHash: '0xdef', verifiedAt: '2027-01-01T00:00:00Z' };
    expect(collectibleTrust({ ...c, status: 'verified', chain }).label).toBe('Verified on-chain');
  });

  it('formats money from integer minor units', () => {
    expect(formatMoney(usd(499), 'en-US')).toBe('$4.99');
    expect(formatMoney(usd(1999), 'en-US')).toBe('$19.99');
  });
});

describe('Embers', () => {
  const rules = DEFAULT_RULES;

  it('awards by rule, idempotently', () => {
    const a = award(emptyRewards, rules, 'glyph-discovered', 'g1', NOW);
    expect(a.awarded).toBe(true);
    const b = award(a.ledger, rules, 'glyph-discovered', 'g1', NOW + 1);
    expect(b).toMatchObject({ awarded: false, reason: 'duplicate' });
    expect(balance(b.ledger)).toBe(1);
  });

  it('enforces daily and weekly caps', () => {
    let l = emptyRewards;
    for (const g of ['a', 'b', 'c']) l = award(l, rules, 'glyph-discovered', g, NOW).ledger;
    expect(award(l, rules, 'glyph-discovered', 'd', NOW)).toMatchObject({ awarded: false, reason: 'daily-cap' });
    expect(award(l, rules, 'glyph-discovered', 'd', NOW + 86400_000).awarded).toBe(true);
    const w = award(emptyRewards, rules, 'chapter-complete', 'c1', NOW).ledger;
    expect(award(w, rules, 'chapter-complete', 'c2', NOW + 86400_000)).toMatchObject({ awarded: false, reason: 'weekly-cap' });
  });

  it('skips disabled or missing rules', () => {
    expect(award(emptyRewards, rules, 'lore-challenge', 'q', NOW)).toMatchObject({ awarded: false, reason: 'disabled' });
    const none: RewardRule[] = [];
    expect(award(emptyRewards, none, 'glyph-discovered', 'q', NOW)).toMatchObject({ awarded: false, reason: 'no-rule' });
  });

  it('redeems only offered items, never below zero, and chapter unlocks only when the policy allows', () => {
    const l = award(award(emptyRewards, rules, 'collection-complete', 'k', NOW).ledger, rules, 'glyph-discovered', 'g', NOW).ledger;
    expect(balance(l)).toBe(4);
    const art = { id: 'wallpaper', kind: 'artwork' as const, title: 'Wallpaper', cost: 3 };
    const r = redeem(l, art, 'r1', NOW);
    expect(r.ok && balance(r.ledger)).toBe(1);
    expect(redeem(r.ledger, art, 'r1', NOW)).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(redeem(r.ledger, art, 'r2', NOW)).toMatchObject({ ok: false, reason: 'insufficient' });
    const unlock = { id: 'u', kind: 'chapter-unlock' as const, title: 'Unlock', cost: 1, chapterId: 'c2' };
    expect(redeem(l, unlock, 'r3', NOW)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(redeem(l, unlock, 'r3', NOW, true).ok).toBe(true);
  });

  it('merges device ledgers without double counting', () => {
    const a = award(emptyRewards, rules, 'glyph-discovered', 'g1', NOW).ledger;
    const b = award(a, rules, 'glyph-discovered', 'g2', NOW + 1000).ledger;
    const merged = mergeRewards(a, b);
    expect(balance(merged)).toBe(2);
    expect(mergeRewards(merged, merged)).toEqual(merged);
  });

  it('counts reading streaks ending today or yesterday', () => {
    expect(readingStreak(['2026-11-29', '2026-11-30', '2026-12-01'], NOW)).toBe(3);
    expect(readingStreak(['2026-11-29', '2026-11-30'], NOW)).toBe(2);
    expect(readingStreak(['2026-11-28'], NOW)).toBe(0);
  });
});
