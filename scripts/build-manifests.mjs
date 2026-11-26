#!/usr/bin/env node
/**
 * Builds signed publication manifests from editorial sources.
 *
 *   node scripts/build-manifests.mjs                 # write src/content/manifests/*.json
 *   node scripts/build-manifests.mjs --check         # exit 1 if any committed manifest is stale
 *   node scripts/build-manifests.mjs --key k.pem --key-id talonsight-prod-1
 *
 * For every page: sha256 of the file bytes, byte length, pixel size (read
 * from the file header). publicationHash = sha256(canonicalJson({ chapterId,
 * credits, pageHashes, seriesId })). The manifest is signed with ed25519
 * over canonicalJson(manifest without signature).
 *
 * canonicalJson and the header parsers must match src/domain; the test suite
 * re-derives everything with the app's own implementations to enforce that.
 */
import { Buffer } from 'node:buffer';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'content-src');
const outDir = join(root, 'src/content/manifests');
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const keyPath = arg('--key') ?? join(root, 'scripts/dev-keys/talonsight-dev-1.pem');
const keyId = arg('--key-id') ?? 'talonsight-dev-1';

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}
const sha = (data) => createHash('sha256').update(data).digest('hex');

/** Pixel size from JPEG / PNG / WebP headers. */
function imageSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error('unsupported image');
}

const key = createPrivateKey(readFileSync(keyPath));
let stale = false;

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.json'))) {
  const src = JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  const { $comment: _, ...head } = src;
  const publications = src.publications.map((p) => {
    const pages = p.pages.map(({ file: path, ...pg }) => {
      const bytes = readFileSync(join(root, path));
      const { width, height } = imageSize(bytes);
      return { ...pg, width, height, sha256: sha(bytes), bytes: bytes.length };
    });
    const pageHashes = pages.map((pg) => pg.sha256);
    const publicationHash = pages.length
      ? sha(canonicalJson({ seriesId: src.series.id, chapterId: p.publicationId, credits: p.credits, pageHashes }))
      : null;
    return { ...p, pageCount: p.pageCount ?? pages.length, pages, integrity: { algorithm: 'sha256-canonical-v1', publicationHash } };
  });
  const manifest = { schema: 'echoreader.manifest/1', ...head, publications };
  const value = sign(null, Buffer.from(canonicalJson(manifest), 'utf8'), key).toString('hex');
  const signed = { ...manifest, signature: { alg: 'ed25519', keyId, value } };
  const out = `${JSON.stringify(signed, null, 2)}\n`;
  const target = join(outDir, file);
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(target, 'utf8'); } catch {}
    if (current !== out) { console.error(`${file} is stale. Run: npm run build-manifests`); stale = true; }
  } else {
    writeFileSync(target, out);
    for (const p of publications) console.log(`${p.publicationId.padEnd(16)} ${p.integrity.publicationHash ?? '(no pages)'}`);
  }
}
if (stale) process.exit(1);
if (process.argv.includes('--check')) console.log('Manifests are up to date.');
