import * as Crypto from 'expo-crypto';

import type { Edition, PurchaseTransaction } from '@/domain/commerce/types';

import { config } from './config';

/**
 * Provider-independent purchasing. Production purchases of digital comics
 * must use Apple In-App Purchase / Google Play Billing; that provider is not
 * built yet (no store products exist). This build offers:
 *
 *   sandbox  test purchases recorded locally, labeled "Sandbox" everywhere,
 *            honored only by sandbox builds, flagged synthetic in analytics
 *   none     purchasing is unavailable and the UI says so
 */

export type CommerceProvider = {
  kind: 'sandbox' | 'none';
  available: boolean;
  /** Human label for the purchase button context. */
  label: string;
  purchase(edition: Edition): Promise<PurchaseTransaction>;
  restore(known: readonly PurchaseTransaction[]): Promise<PurchaseTransaction[]>;
  /** Sandbox only: simulate a store refund. */
  refund?(tx: PurchaseTransaction): Promise<PurchaseTransaction>;
};

const sandbox: CommerceProvider = {
  kind: 'sandbox',
  available: true,
  label: 'Sandbox purchase · no charge',
  async purchase(edition) {
    const now = new Date().toISOString();
    return {
      id: `sandbox-${Crypto.randomUUID()}`,
      productId: edition.productIds.ios ?? edition.id,
      editionId: edition.id,
      chapterId: edition.chapterId,
      status: 'completed',
      amount: edition.price,
      createdAt: now,
      updatedAt: now,
      environment: 'sandbox',
      verification: 'sandbox',
    };
  },
  async restore(known) {
    return known.filter((t) => t.environment === 'sandbox');
  },
  async refund(tx) {
    return { ...tx, status: 'refunded', updatedAt: new Date().toISOString() };
  },
};

const none: CommerceProvider = {
  kind: 'none',
  available: false,
  label: 'Purchases open soon',
  async purchase() {
    throw new Error('Purchasing is not available in this build');
  },
  async restore() {
    return [];
  },
};

export const commerce: CommerceProvider = config.commerce === 'sandbox' ? sandbox : none;
