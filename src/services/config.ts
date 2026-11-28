import { PRODUCTION_TRUST, SANDBOX_TRUST } from '@/domain/commerce/access';

/**
 * Build-time configuration. Nothing here is a secret: EXPO_PUBLIC_* values
 * are embedded in the app bundle.
 *
 *   EXPO_PUBLIC_COMMERCE      'sandbox' enables test purchases (always on in development)
 *   EXPO_PUBLIC_CONTENT_URL   base URL of the content service (remote manifests)
 *   EXPO_PUBLIC_SUPABASE_URL  backend for accounts and sync (not yet wired)
 */
const dev = typeof __DEV__ !== 'undefined' && __DEV__;

export const config = {
  commerce: (process.env.EXPO_PUBLIC_COMMERCE === 'sandbox' || dev ? 'sandbox' : 'none') as 'sandbox' | 'none',
  contentUrl: process.env.EXPO_PUBLIC_CONTENT_URL || null,
  backendUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || null,
};

/** Which entitlements this build honors. */
export const TRUST = config.commerce === 'sandbox' ? SANDBOX_TRUST : PRODUCTION_TRUST;
