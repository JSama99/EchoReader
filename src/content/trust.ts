import type { TrustedIssuer } from '@/domain/signature';

/**
 * Manifest issuers this app trusts. Add a production key with
 * `npm run keygen` (see scripts/dev-keys/README.md). Development keys are
 * public and are trusted only in development builds.
 */
export const TRUSTED_ISSUERS: readonly TrustedIssuer[] = [
  {
    keyId: 'talonsight-dev-1',
    publisherId: 'talonsight',
    name: 'TalonSight Technologies (development key)',
    publicKey: 'daa5890e69912eba33aea6b6703025a5d6d2f983b1e9d9a5c1cc06512d401301',
    environment: 'development',
  },
];

/** Development keys count only in development builds. */
export const ALLOW_DEVELOPMENT_KEYS: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
