import { Inflate } from 'fflate';

import { parseComicInfo, type ComicInfo } from './comicinfo';
import { ImportError, type ImportLimits } from './limits';
import { imageSize, isImageKind, sniff, type ImageKind } from './sniff';

/**
 * A deliberately small ZIP reader for CBZ comics.
 *
 * Why not a general unzip: we need control over every byte that is
 * decompressed. The central directory is parsed first and every entry is
 * checked (count, declared size, compression ratio, encryption, path) before
 * a single byte is inflated. Each page is then inflated alone into a buffer of
 * exactly its declared size, and its CRC-32 must match, so a lying header can
 * neither grow memory nor smuggle in different bytes. Entry names are never
 * used as file paths: pages are written as page-0001.jpg and so on.
 */

export type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
};

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

export function readCentralDirectory(b: Uint8Array, limits: ImportLimits): ZipEntry[] {
  // End of central directory: 22 bytes + up to 65535 bytes of comment.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ImportError('corrupt', 'No ZIP end-of-directory record');
  const count = u16(b, eocd + 10);
  const cdSize = u32(b, eocd + 12);
  const cdOffset = u32(b, eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ImportError('too-large', 'ZIP64 archives are not supported');
  if (count > limits.maxEntries) throw new ImportError('too-many-entries', `${count} entries`);
  if (cdOffset + cdSize > b.length) throw new ImportError('corrupt', 'Central directory out of bounds');

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw new ImportError('corrupt', 'Bad central directory entry');
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    if (p + 46 + nameLen > b.length) throw new ImportError('corrupt', 'Entry name out of bounds');
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    entries.push({
      name,
      flags: u16(b, p + 8),
      method: u16(b, p + 10),
      crc: u32(b, p + 16),
      compressedSize: u32(b, p + 20),
      size: u32(b, p + 24),
      localOffset: u32(b, p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Path checks: absolute paths, drive letters, traversal, NUL and backslash tricks. */
export function isUnsafePath(name: string): boolean {
  if (name.includes('\0')) return true;
  const n = name.replace(/\\/g, '/');
  if (n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return true;
  return n.split('/').some((seg) => seg === '..');
}

const IGNORED = (name: string) => {
  const n = name.replace(/\\/g, '/');
  const base = n.split('/').pop() ?? '';
  return n.endsWith('/') || n.startsWith('__MACOSX/') || base.startsWith('.') || base.toLowerCase() === 'thumbs.db';
};

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

/** Natural order: "page2" before "page10"; case-insensitive; full path. */
export function naturalCompare(a: string, b: string): number {
  const ax = a.toLowerCase().match(/\d+|\D+/g) ?? [];
  const bx = b.toLowerCase().match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(ax.length, bx.length); i++) {
    const [x, y] = [ax[i], bx[i]];
    if (x === y) continue;
    const nx = /^\d/.test(x) && /^\d/.test(y);
    if (nx && Number(x) !== Number(y)) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  return ax.length - bx.length;
}

let CRC_TABLE: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inflate one entry into a buffer of exactly its declared size, then CRC-check it. */
export function extractEntry(b: Uint8Array, e: ZipEntry): Uint8Array {
  const lh = e.localOffset;
  if (lh + 30 > b.length || u32(b, lh) !== 0x04034b50) throw new ImportError('corrupt', 'Bad local header');
  const start = lh + 30 + u16(b, lh + 26) + u16(b, lh + 28);
  const end = start + e.compressedSize;
  if (end > b.length) throw new ImportError('corrupt', 'Entry data out of bounds');
  const raw = b.subarray(start, end);
  let out: Uint8Array;
  if (e.method === 0) {
    if (e.compressedSize !== e.size) throw new ImportError('corrupt', 'Stored entry size mismatch');
    out = raw.slice();
  } else if (e.method === 8) {
    out = inflateBounded(raw, e.size);
  } else {
    throw new ImportError('unsupported', `Compression method ${e.method}`);
  }
  if (out.length !== e.size || crc32(out) !== e.crc) throw new ImportError('corrupt', 'Entry failed its integrity check');
  return out;
}

/**
 * Streaming inflate that stops as soon as output would exceed `size`, so a
 * stream that lies about its size costs at most one extra chunk of work.
 */
export function inflateBounded(raw: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let written = 0;
  let overflow = false;
  let done = false;
  const inf = new Inflate((chunk, final) => {
    if (written + chunk.length > size) {
      overflow = true;
      return;
    }
    out.set(chunk, written);
    written += chunk.length;
    if (final) done = true;
  });
  const STEP = 16 * 1024;
  try {
    for (let i = 0; i < raw.length && !overflow; i += STEP) {
      const end = Math.min(raw.length, i + STEP);
      inf.push(raw.subarray(i, end), end === raw.length);
    }
  } catch {
    throw new ImportError('corrupt', 'Inflate failed');
  }
  if (overflow) throw new ImportError('suspicious-compression', 'Entry inflates past its declared size');
  if (!done || written !== size) throw new ImportError('corrupt', 'Entry is shorter than declared');
  return out;
}

export type ArchivePlan = { pages: ZipEntry[]; comicInfo?: ZipEntry };

/** Decide what will be read, enforcing every limit before inflating anything. */
export function planArchive(entries: ZipEntry[], limits: ImportLimits): ArchivePlan {
  if (entries.some((e) => isUnsafePath(e.name))) throw new ImportError('unsafe-paths', 'Unsafe entry path');
  const files = entries.filter((e) => !IGNORED(e.name));
  const pages = files.filter((e) => IMAGE_EXT.test(e.name)).sort((a, b) => naturalCompare(a.name, b.name));
  const comicInfo = files.find((e) => e.name.replace(/\\/g, '/').split('/').pop()?.toLowerCase() === 'comicinfo.xml');

  if (pages.length === 0) throw new ImportError('empty', 'No images in archive');
  if (pages.length > limits.maxPages) throw new ImportError('too-many-pages', `${pages.length} pages`);
  let total = 0;
  for (const e of [...pages, ...(comicInfo ? [comicInfo] : [])]) {
    if (e.flags & 1) throw new ImportError('encrypted', e.name);
    if (e.method !== 0 && e.method !== 8) throw new ImportError('unsupported', `Compression method ${e.method}`);
    if (e.size > limits.maxPageBytes) throw new ImportError('page-too-large', e.name);
    if (e.compressedSize === 0 ? e.size > 0 : e.size / e.compressedSize > limits.maxRatio) {
      throw new ImportError('suspicious-compression', e.name);
    }
    // Deflate never grows real data by more than a few bytes per 16 KB block.
    if (e.compressedSize > e.size + 1024 + e.size / 100) throw new ImportError('suspicious-compression', e.name);
    total += e.size;
  }
  if (total > limits.maxTotalBytes) throw new ImportError('total-too-large', `${total} bytes`);
  return { pages, comicInfo };
}

export type CheckedImage = { kind: ImageKind; width: number; height: number };

/** Confirm bytes are a supported image by content, and within pixel limits. */
export function checkImage(bytes: Uint8Array, limits: ImportLimits): CheckedImage | null {
  const kind = sniff(bytes);
  if (!isImageKind(kind)) return null;
  const size = imageSize(bytes);
  if (!size) return null;
  if (size.width * size.height > limits.maxPixels) throw new ImportError('image-too-large', `${size.width}×${size.height}`);
  return { kind, ...size };
}

export function readComicInfo(b: Uint8Array, plan: ArchivePlan): ComicInfo {
  if (!plan.comicInfo || plan.comicInfo.size > 64 * 1024) return {};
  try {
    return parseComicInfo(new TextDecoder().decode(extractEntry(b, plan.comicInfo)));
  } catch {
    return {};
  }
}
