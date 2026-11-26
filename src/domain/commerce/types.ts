/**
 * Commercial domain model.
 *
 * Three concepts are deliberately separate and must never be collapsed:
 *
 *   Availability   whether the publisher has released a publication at all
 *   Entitlement    the right of a reader to read it (purchase, subscription,
 *                  promotion, reward, grant)
 *   Collectible    ownership of a numbered digital edition. Ownership never
 *                  grants reading: an edition's reading right comes from the
 *                  purchase entitlement, as App Store guideline 3.1.1 requires
 *                  ("NFT ownership may not unlock content or functionality").
 *
 * All prices, supplies and benefits are data from the publication manifest.
 */

export type Money = {
  /** Integer minor units (cents). Never floats for money. */
  amountMinor: number;
  /** ISO 4217, e.g. "USD". */
  currency: string;
};

export type EditionTier = 'standard' | 'collector' | 'legendary';

export type Edition = {
  id: string;
  chapterId: string;
  tier: EditionTier;
  title: string;
  price: Money;
  /** Store SKUs. Purchases must go through the platform store where required. */
  productIds: { ios?: string; android?: string; web?: string };
  /** Benefits as shown to readers; publisher-authored. */
  benefits: string[];
  /** Every edition includes the complete readable chapter. */
  includesReading: true;
  /** Numbered collectible attached to this edition, if any. */
  collectible: null | {
    kind: 'numbered';
    /** Maximum number of copies; null = open edition. */
    supply: number | null;
    /** Intended token standard once minting exists. Informational only. */
    standard: 'erc721' | 'erc1155';
  };
  onSale: boolean;
};

/** A time-boxed publisher promotion, e.g. a free weekend. */
export type Promotion = {
  id: string;
  kind: 'free';
  label: string;
  startsAt: string;
  endsAt: string;
};

export type AccessPolicy = {
  chapterId: string;
  /** Free to every reader, or sold through editions. */
  base: 'free' | 'paid';
  /** Pages readable without an entitlement when base is 'paid'. 0 = no preview. */
  previewPages: number;
  promotions: Promotion[];
  /** Whether an active subscription grants reading. */
  subscriptionEligible: boolean;
  /**
   * Optional Ember price to unlock reading. Absent by default: Embers never
   * unlock paid publications unless the publisher opts a chapter in.
   */
  emberUnlockCost?: number;
};

export type AvailabilityStatus = 'draft' | 'scheduled' | 'published' | 'archived' | 'unavailable';

export type Availability = {
  chapterId: string;
  status: AvailabilityStatus;
  /** For 'scheduled': ISO release instant. Becomes published at or after it. */
  releaseAt?: string;
};

export type EntitlementSource = 'purchase' | 'subscription' | 'promotion' | 'reward' | 'grant';

/**
 * How an entitlement was established. Only store- or server-verified records
 * are honored in production; sandbox and local records are development only.
 */
export type Verification = 'store-verified' | 'server-verified' | 'sandbox' | 'local';

export type Entitlement = {
  id: string;
  chapterId: string;
  editionId?: string;
  source: EntitlementSource;
  status: 'active' | 'refunded' | 'revoked' | 'expired';
  grantedAt: string;
  expiresAt?: string;
  transactionId?: string;
  verification: Verification;
};

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export type PurchaseTransaction = {
  /** Store transaction id. The idempotency key for every operation. */
  id: string;
  productId: string;
  editionId: string;
  chapterId: string;
  status: TransactionStatus;
  amount: Money;
  createdAt: string;
  updatedAt: string;
  environment: 'sandbox' | 'production';
  verification: Verification;
};

export type ChainRef = {
  network: string;
  standard: 'erc721' | 'erc1155';
  contract: string;
  tokenId: string;
  txHash: string;
  verifiedAt: string;
};

/**
 * demo           illustrative; not owned by anyone
 * reserved       edition purchased; collectible not minted
 * minted-unverified  a chain reference exists but has not been verified
 * verified       a verified on-chain record exists
 */
export type CollectibleStatus = 'demo' | 'reserved' | 'minted-unverified' | 'verified';

export type Collectible = {
  id: string;
  editionId: string;
  chapterId: string;
  transactionId?: string;
  /** Edition number, assigned by the server when allocated. */
  serial?: number;
  supply?: number | null;
  status: CollectibleStatus;
  environment: 'sandbox' | 'production';
  chain?: ChainRef;
};

/** Everything a device knows about one reader's commercial standing. */
export type CommerceLedger = {
  transactions: PurchaseTransaction[];
  entitlements: Entitlement[];
  collectibles: Collectible[];
};

export const emptyLedger: CommerceLedger = { transactions: [], entitlements: [], collectibles: [] };
