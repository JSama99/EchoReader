import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { getChapter, ledgerFor } from '@/content/catalog';
import { pageImages } from '@/content/images';
import { verifyChapter, type VerifyResult } from '@/domain/pow';

/**
 * Device side of POW verification: hash the exact bytes this device will
 * render, then let the pure domain function compare them with the ledger.
 */

const sha256String = (s: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s, { encoding: Crypto.CryptoEncoding.HEX });

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function readBytes(moduleId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new File(uri).bytes();
}

async function hashPage(pageId: string): Promise<string> {
  const mod = pageImages[pageId];
  if (mod == null) return '';
  const bytes = await readBytes(mod);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as unknown as BufferSource);
  return toHex(digest);
}

const cache = new Map<string, Promise<VerifyResult>>();

/** Verifies once per app session per chapter; safe to call from any screen. */
export function verifyBundledChapter(chapterId: string): Promise<VerifyResult> {
  const hit = cache.get(chapterId);
  if (hit) return hit;
  const run = (async (): Promise<VerifyResult> => {
    const chapter = getChapter(chapterId);
    if (!chapter || chapter.pages.length === 0) return { status: 'no-record' };
    const localPageHashes = await Promise.all(chapter.pages.map((p) => hashPage(p.id)));
    return verifyChapter(sha256String, {
      seriesId: chapter.seriesId,
      chapterId,
      credits: chapter.credits,
      localPageHashes,
      record: ledgerFor(chapterId),
    });
  })().catch((): VerifyResult => ({ status: 'no-record' }));
  cache.set(chapterId, run);
  return run;
}

/** Drop a cached result, e.g. after re-downloading pages. */
export function forgetVerification(chapterId: string) {
  cache.delete(chapterId);
}
