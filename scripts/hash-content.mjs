#!/usr/bin/env node
/**
 * Builds the POW ledger records for bundled editions.
 *
 *   node scripts/hash-content.mjs          # write src/content/ledger.generated.json
 *   node scripts/hash-content.mjs --check  # exit 1 if the committed ledger is stale
 *
 * pageHash    = sha256(file bytes)
 * chapterHash = sha256(canonicalJson({ chapterId, credits, pageHashes, seriesId }))
 *
 * canonicalJson must stay byte-identical to src/domain/pow.ts; the test suite
 * re-derives every chapterHash with the app's implementation to enforce that.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const editionsPath = join(root, 'src/content/editions.json');
const ledgerPath = join(root, 'src/content/ledger.generated.json');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

const sha = (data) => createHash('sha256').update(data).digest('hex');

const editions = JSON.parse(readFileSync(editionsPath, 'utf8'));
const records = editions.chapters.map((ch) => {
  const files = ch.pages.map((p) => readFileSync(join(root, p)));
  const pageHashes = files.map((f) => sha(f));
  const pageBytes = files.map((f) => f.length);
  const chapterHash = sha(
    canonicalJson({ seriesId: ch.seriesId, chapterId: ch.chapterId, credits: ch.credits, pageHashes }),
  );
  return { chapterId: ch.chapterId, pageHashes, pageBytes, chapterHash };
});

const out = `${JSON.stringify({ records }, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(ledgerPath, 'utf8');
  if (current !== out) {
    console.error('ledger.generated.json is stale. Run: npm run hash-content');
    process.exit(1);
  }
  console.log('Ledger is up to date.');
} else {
  writeFileSync(ledgerPath, out);
  for (const r of records) console.log(`${r.chapterId}  ${r.chapterHash}`);
}
