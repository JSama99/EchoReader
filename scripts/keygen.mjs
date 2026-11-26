#!/usr/bin/env node
/** Create an ed25519 signing key. Usage: npm run keygen -- <path-outside-the-repo.pem> */
import { Buffer } from 'node:buffer';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('Usage: npm run keygen -- <path.pem>'); process.exit(1); }
if (existsSync(path)) { console.error(`${path} exists; refusing to overwrite a key.`); process.exit(1); }
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
writeFileSync(path, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
console.log(`Private key written to ${path} (keep it secret, never commit it).`);
console.log(`Public key (add to src/content/trust.ts): ${Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex')}`);
