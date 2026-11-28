import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

import { signingPayload, type PublicationManifest } from './manifest';

/**
 * Issuer verification for publication manifests (ed25519).
 *
 * What a valid signature proves: the manifest was issued by the holder of a
 * key the app trusts, and has not been altered since. It does NOT prove
 * copyright ownership, authorship, or blockchain ownership of anything.
 */

ed.hashes.sha512 = sha512;

export type TrustedIssuer = {
  keyId: string;
  publisherId: string;
  name: string;
  /** Raw 32-byte public key, hex. */
  publicKey: string;
  /** Development keys are public and only trusted in development builds. */
  environment: 'development' | 'production';
};

export type SignatureStatus =
  | { status: 'trusted'; issuer: TrustedIssuer }
  | { status: 'development-key'; issuer: TrustedIssuer }
  | { status: 'unknown-key'; keyId: string }
  | { status: 'publisher-mismatch'; issuer: TrustedIssuer }
  | { status: 'invalid' }
  | { status: 'unsigned' };

const hexToBytes = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export function verifyManifestSignature(
  m: PublicationManifest,
  issuers: readonly TrustedIssuer[],
  allowDevelopmentKeys: boolean,
): SignatureStatus {
  if (!m.signature) return { status: 'unsigned' };
  const issuer = issuers.find((i) => i.keyId === m.signature!.keyId);
  if (!issuer) return { status: 'unknown-key', keyId: m.signature.keyId };
  let valid = false;
  try {
    valid = ed.verify(hexToBytes(m.signature.value), new TextEncoder().encode(signingPayload(m)), hexToBytes(issuer.publicKey));
  } catch {
    valid = false;
  }
  if (!valid) return { status: 'invalid' };
  if (issuer.publisherId !== m.publisher.id) return { status: 'publisher-mismatch', issuer };
  if (issuer.environment === 'development' && !allowDevelopmentKeys) return { status: 'development-key', issuer };
  return { status: 'trusted', issuer };
}

/** May the app use this manifest at all? */
export function isAcceptable(s: SignatureStatus, allowDevelopmentKeys: boolean): boolean {
  return s.status === 'trusted' || (allowDevelopmentKeys && s.status === 'development-key');
}
