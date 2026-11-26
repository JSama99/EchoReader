import type { Credit, LedgerRecord } from './types';

/**
 * POW-verified editions.
 *
 * pageHash    = sha256(page image bytes)                      (hex)
 * chapterHash = sha256(canonicalJson({ chapterId, credits, pageHashes, seriesId }))
 *
 * The ledger publishes { pageHashes, chapterHash } per chapter. On open, the
 * reader hashes the bytes it actually has and compares. A mismatch never
 * blocks reading: it names the pages and offers a re-download.
 */

export type Sha256Hex = (input: string) => Promise<string>;

/** Deterministic JSON: object keys sorted, no whitespace, arrays in order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export async function computeChapterHash(
  sha256: Sha256Hex,
  input: { seriesId: string; chapterId: string; credits: Credit[]; pageHashes: string[] },
): Promise<string> {
  return sha256(canonicalJson(input));
}

export type VerifyResult =
  | { status: 'verified'; chapterHash: string }
  | {
      status: 'mismatch';
      /** 0-based indexes of pages whose bytes differ from the ledger. */
      mismatchedPages: number[];
      ledgerHash: string;
      localHash: string;
    }
  | { status: 'no-record' };

export async function verifyChapter(
  sha256: Sha256Hex,
  args: {
    seriesId: string;
    chapterId: string;
    credits: Credit[];
    localPageHashes: string[];
    record: LedgerRecord | undefined;
  },
): Promise<VerifyResult> {
  const { record } = args;
  if (!record || record.chapterId !== args.chapterId) return { status: 'no-record' };

  const localHash = await computeChapterHash(sha256, {
    seriesId: args.seriesId,
    chapterId: args.chapterId,
    credits: args.credits,
    pageHashes: args.localPageHashes,
  });

  const count = Math.max(record.pageHashes.length, args.localPageHashes.length);
  const mismatchedPages: number[] = [];
  for (let i = 0; i < count; i++) {
    if (record.pageHashes[i] !== args.localPageHashes[i]) mismatchedPages.push(i);
  }

  if (mismatchedPages.length === 0 && localHash === record.chapterHash) {
    return { status: 'verified', chapterHash: localHash };
  }
  return { status: 'mismatch', mismatchedPages, ledgerHash: record.chapterHash, localHash };
}

/** "7f3a…c91e" */
export function shortHash(hex: string): string {
  return hex.length <= 8 ? hex : `${hex.slice(0, 4)}…${hex.slice(-4)}`;
}
