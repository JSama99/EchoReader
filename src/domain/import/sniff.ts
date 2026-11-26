/**
 * File type detection from magic bytes, and image dimensions read from file
 * headers without decoding pixels. Extensions are never trusted.
 */

export type Sniffed = 'jpeg' | 'png' | 'webp' | 'gif' | 'pdf' | 'zip' | 'rar' | 'unknown';

export function sniff(b: Uint8Array): Sniffed {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  if (b.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return 'jpeg';
  if (b.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (b.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp';
  if (b.length >= 6 && at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (b.length >= 5 && at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';
  if (b.length >= 4 && at(0, 0x50, 0x4b) && (at(2, 0x03, 0x04) || at(2, 0x05, 0x06))) return 'zip';
  if (b.length >= 7 && at(0, 0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)) return 'rar';
  return 'unknown';
}

export const IMAGE_KINDS = ['jpeg', 'png', 'webp'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
export const isImageKind = (k: Sniffed): k is ImageKind => (IMAGE_KINDS as readonly string[]).includes(k);
export const extensionFor: Record<ImageKind, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);

/** Pixel size from a JPEG, PNG or WebP header, or null if malformed. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const kind = sniff(b);
  if (kind === 'png') {
    if (b.length < 24) return null;
    return positive(u32be(b, 16), u32be(b, 20));
  }
  if (kind === 'jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      // Standalone markers carry no length.
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      // SOF0..SOF15, excluding DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return positive(u16be(b, i + 7), u16be(b, i + 5));
      }
      const len = u16be(b, i + 2);
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  if (kind === 'webp') {
    if (b.length < 30) return null;
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8X') return positive(u24le(b, 24) + 1, u24le(b, 27) + 1);
    if (chunk === 'VP8 ') return positive(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return positive((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
  }
  return null;
}

const positive = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);
