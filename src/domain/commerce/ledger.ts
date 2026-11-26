import type {
  Collectible,
  CollectibleStatus,
  CommerceLedger,
  Edition,
  Entitlement,
  Money,
  PurchaseTransaction,
  TransactionStatus,
} from './types';

/**
 * Idempotent purchase processing. A store can deliver the same transaction
 * many times (retries, restore, server webhooks). Applying it twice must give
 * the same ledger as applying it once, and statuses only move forward.
 */

const NEXT: Record<TransactionStatus, readonly TransactionStatus[]> = {
  pending: ['completed', 'failed', 'cancelled'],
  completed: ['refunded'],
  failed: [],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return NEXT[from].includes(to);
}

export const entitlementIdFor = (txId: string) => `ent:${txId}`;
export const collectibleIdFor = (txId: string) => `col:${txId}`;

export type ApplyResult = { ledger: CommerceLedger; changed: boolean; ignored?: 'duplicate' | 'invalid-transition' | 'unknown-edition' };

export function applyTransaction(ledger: CommerceLedger, tx: PurchaseTransaction, editions: readonly Edition[]): ApplyResult {
  const edition = editions.find((e) => e.id === tx.editionId);
  if (!edition || edition.chapterId !== tx.chapterId) return { ledger, changed: false, ignored: 'unknown-edition' };

  const existing = ledger.transactions.find((t) => t.id === tx.id);
  if (existing) {
    if (existing.status === tx.status) return { ledger, changed: false, ignored: 'duplicate' };
    if (!canTransition(existing.status, tx.status)) return { ledger, changed: false, ignored: 'invalid-transition' };
  }

  const record: PurchaseTransaction = existing ? { ...existing, status: tx.status, updatedAt: tx.updatedAt } : tx;
  let next: CommerceLedger = {
    ...ledger,
    transactions: existing ? ledger.transactions.map((t) => (t.id === tx.id ? record : t)) : [...ledger.transactions, record],
  };

  if (record.status === 'completed') next = grant(next, record, edition);
  if (record.status === 'refunded') next = revoke(next, record);
  return { ledger: next, changed: true };
}

function grant(ledger: CommerceLedger, tx: PurchaseTransaction, edition: Edition): CommerceLedger {
  const entId = entitlementIdFor(tx.id);
  const entitlement: Entitlement = {
    id: entId,
    chapterId: tx.chapterId,
    editionId: tx.editionId,
    source: 'purchase',
    status: 'active',
    grantedAt: tx.updatedAt,
    transactionId: tx.id,
    verification: tx.verification,
  };
  const entitlements = ledger.entitlements.some((e) => e.id === entId)
    ? ledger.entitlements
    : [...ledger.entitlements, entitlement];

  let collectibles = ledger.collectibles;
  const colId = collectibleIdFor(tx.id);
  if (edition.collectible && !collectibles.some((c) => c.id === colId)) {
    collectibles = [
      ...collectibles,
      {
        id: colId,
        editionId: edition.id,
        chapterId: edition.chapterId,
        transactionId: tx.id,
        supply: edition.collectible.supply,
        status: 'reserved',
        environment: tx.environment,
      },
    ];
  }
  return { ...ledger, entitlements, collectibles };
}

function revoke(ledger: CommerceLedger, tx: PurchaseTransaction): CommerceLedger {
  const entId = entitlementIdFor(tx.id);
  const colId = collectibleIdFor(tx.id);
  return {
    ...ledger,
    entitlements: ledger.entitlements.map((e) => (e.id === entId ? { ...e, status: 'refunded' } : e)),
    // An unminted reservation is released on refund. Minted tokens live on a
    // chain and are handled by the issuer's refund policy, so they are kept.
    collectibles: ledger.collectibles.filter((c) => c.id !== colId || (c.status !== 'reserved' && c.status !== 'demo')),
  };
}

/** Restore = apply every transaction the store reports, idempotently. */
export function restoreTransactions(ledger: CommerceLedger, txs: readonly PurchaseTransaction[], editions: readonly Edition[]): CommerceLedger {
  return txs.reduce((l, tx) => applyTransaction(l, tx, editions).ledger, ledger);
}

/**
 * Server-side serial allocation for numbered editions. Returns the next
 * serial or null when the edition is sold out. Kept pure so the backend and
 * tests share one implementation.
 */
export function nextSerial(allocated: readonly Collectible[], editionId: string, supply: number | null): number | null {
  const used = allocated.filter((c) => c.editionId === editionId && c.serial != null).map((c) => c.serial!);
  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  if (supply != null && next > supply) return null;
  return next;
}

/** Only a verified chain record is genuine ownership of a token. */
export function isVerifiedOwnership(c: Collectible): boolean {
  return (
    c.status === 'verified' &&
    c.environment === 'production' &&
    !!c.chain &&
    !!c.chain.contract &&
    !!c.chain.tokenId &&
    !!c.chain.txHash &&
    !!c.chain.verifiedAt
  );
}

export type TrustTone = 'verified' | 'owned' | 'pending' | 'demo';

/** The honest label every collectible must carry wherever it is shown. */
export function collectibleTrust(c: Collectible): { label: string; detail: string; tone: TrustTone } {
  if (c.environment === 'sandbox') {
    return { label: 'Sandbox', detail: 'Created by a test purchase. Not a real collectible.', tone: 'demo' };
  }
  const by: Record<CollectibleStatus, { label: string; detail: string; tone: TrustTone }> = {
    demo: { label: 'Demo', detail: 'An example of a future collectible. Not owned by anyone.', tone: 'demo' },
    reserved: {
      label: 'Reserved',
      detail: 'Your edition is recorded. The collectible has not been minted on a blockchain.',
      tone: 'pending',
    },
    'minted-unverified': {
      label: 'Awaiting verification',
      detail: 'A blockchain record is referenced but has not been verified.',
      tone: 'pending',
    },
    verified: { label: 'Verified on-chain', detail: 'Ownership confirmed against a blockchain record.', tone: 'verified' },
  };
  const base = by[c.status];
  if (c.status === 'verified' && !isVerifiedOwnership(c)) return by['minted-unverified'];
  return base;
}

export function formatMoney(m: Money, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(m.amountMinor / 100);
  } catch {
    return `${m.currency} ${(m.amountMinor / 100).toFixed(2)}`;
  }
}
