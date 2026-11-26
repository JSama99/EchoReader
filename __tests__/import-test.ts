import { deflateSync, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { crc32, isUnsafePath, naturalCompare, readCentralDirectory } from '@/domain/import/cbz';
import { displayTitle, parseComicInfo } from '@/domain/import/comicinfo';
import { DEFAULT_LIMITS, ImportError, type ImportLimits } from '@/domain/import/limits';
import { classify, commonTitle, importCbz, importImages, type PageSink, type PickedFile } from '@/domain/import/pipeline';
import { imageSize, sniff } from '@/domain/import/sniff';

const root = join(__dirname, '..');
const JPEG = new Uint8Array(readFileSync(join(root, 'assets/content/flame-sigil/ch1_p04.jpg')));
const NOW = Date.parse('2026-11-26T12:00:00Z');

/** Minimal PNG header (signature + IHDR); enough for sniffing and sizing. */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  return b;
}

const webpVp8x = (w: number, h: number) => {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
  b[24] = (w - 1) & 0xff; b[25] = ((w - 1) >> 8) & 0xff; b[26] = ((w - 1) >> 16) & 0xff;
  b[27] = (h - 1) & 0xff; b[28] = ((h - 1) >> 8) & 0xff; b[29] = ((h - 1) >> 16) & 0xff;
  return b;
};

const picked = (name: string, bytes: Uint8Array): PickedFile => ({ name, size: bytes.length, read: async () => bytes });

function memorySink() {
  const files = new Map<string, Uint8Array>();
  const sink: PageSink = {
    write: async (i, bytes, ext) => {
      const name = `page-${String(i + 1).padStart(4, '0')}.${ext}`;
      files.set(name, bytes);
      return name;
    },
  };
  return { files, sink };
}

async function expectImportError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(ImportError);
  await expect(p).rejects.toMatchObject({ code });
}

const u32 = (b: Uint8Array, i: number, v: number) => new DataView(b.buffer, b.byteOffset).setUint32(i, v, true);
/** Byte offset of the n-th central directory entry. */
function cdEntryOffset(zip: Uint8Array, n: number): number {
  let seen = -1;
  for (let i = 0; i < zip.length - 4; i++) {
    if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x01 && zip[i + 3] === 0x02 && ++seen === n) return i;
  }
  throw new Error('entry not found');
}

describe('format detection', () => {
  it('sniffs by content, never by extension', () => {
    expect(sniff(JPEG)).toBe('jpeg');
    expect(sniff(png(1, 1))).toBe('png');
    expect(sniff(webpVp8x(10, 10))).toBe('webp');
    expect(sniff(new TextEncoder().encode('%PDF-1.7'))).toBe('pdf');
    expect(sniff(zipSync({ a: new Uint8Array([1]) }))).toBe('zip');
    expect(sniff(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]))).toBe('rar');
    expect(sniff(new TextEncoder().encode('<html>'))).toBe('unknown');
  });

  it('reads image dimensions from headers', () => {
    expect(imageSize(JPEG)).toEqual({ width: 1024, height: 1536 });
    expect(imageSize(png(1600, 2400))).toEqual({ width: 1600, height: 2400 });
    expect(imageSize(webpVp8x(1988, 3056))).toEqual({ width: 1988, height: 3056 });
    expect(imageSize(png(0, 10))).toBeNull();
    expect(imageSize(JPEG.slice(0, 20))).toBeNull();
  });

  it('classifies picked files', () => {
    expect(classify([{ name: 'a.cbz', head: zipSync({ x: new Uint8Array(1) }) }])).toBe('cbz');
    expect(classify([{ name: 'a.jpg', head: JPEG }, { name: 'b.png', head: png(1, 1) }])).toBe('images');
    expect(classify([{ name: 'a.cbr', head: new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0]) }])).toBe('rar');
    expect(() => classify([{ name: 'a.jpg', head: JPEG }, { name: 'b.cbz', head: zipSync({ x: new Uint8Array(1) }) }])).toThrow(ImportError);
  });
});

describe('CBZ import', () => {
  it('imports pages in natural order with ComicInfo metadata, skipping junk', async () => {
    const zip = zipSync({
      'Saga/page10.jpg': JPEG,
      'Saga/page2.png': png(800, 1200),
      'Saga/page1.jpg': [JPEG, { level: 0 }],
      'Saga/.DS_Store': new Uint8Array([1, 2]),
      '__MACOSX/Saga/._page1.jpg': new Uint8Array([0, 5]),
      'Saga/notes.txt': new TextEncoder().encode('hi'),
      'Saga/fake.jpg': new TextEncoder().encode('not an image at all'),
      'ComicInfo.xml': new TextEncoder().encode(
        '<ComicInfo><Title>Rise &amp; Fall</Title><Series>Saga</Series><Number>3</Number><Writer>A. Writer</Writer><Manga>YesAndRightToLeft</Manga></ComicInfo>',
      ),
    });
    const { files, sink } = memorySink();
    const out = await importCbz({ id: 'x', file: picked('saga.cbz', zip), now: NOW, limits: DEFAULT_LIMITS, sink });
    expect(out.publication.pages.map((p) => [p.file, p.width, p.height])).toEqual([
      ['page-0001.jpg', 1024, 1536],
      ['page-0002.png', 800, 1200],
      ['page-0003.jpg', 1024, 1536],
    ]);
    expect(out.skipped).toBe(1);
    expect(files.get('page-0001.jpg')).toEqual(JPEG);
    expect(out.publication).toMatchObject({ title: 'Saga #3: Rise & Fall', author: 'A. Writer', direction: 'rtl', format: 'cbz', coverPage: 0 });
  });

  it('rejects path traversal and absolute paths before reading anything', async () => {
    for (const bad of ['../evil.jpg', 'a/../../evil.jpg', '/etc/evil.jpg', 'C:/evil.jpg', 'a\\..\\evil.jpg']) {
      expect(isUnsafePath(bad)).toBe(true);
      const zip = zipSync({ 'ok.jpg': JPEG, [bad.replace(/\\/g, '/')]: JPEG });
      await expectImportError(importCbz({ id: 'x', file: picked('a.cbz', zip), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'unsafe-paths');
    }
    expect(isUnsafePath('a/b..c/page.jpg')).toBe(false);
  });

  it('refuses a zip bomb by compression ratio before inflating', async () => {
    const zip = zipSync({ 'bomb.png': new Uint8Array(20 * 1024 * 1024) });
    await expectImportError(importCbz({ id: 'x', file: picked('bomb.cbz', zip), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'suspicious-compression');
  });

  it('refuses an entry whose header understates its size, without unbounded work', async () => {
    const data = new Uint8Array(2 * 1024 * 1024);
    data.set(png(10, 10));
    const zip = zipSync({ 'liar.png': data });
    const at = cdEntryOffset(zip, 0);
    // Claim 100 KB uncompressed: ratio check passes, but inflating must stop at 100 KB.
    u32(zip, at + 24, 100 * 1024);
    await expectImportError(
      importCbz({ id: 'x', file: picked('liar.cbz', zip), now: NOW, limits: { ...DEFAULT_LIMITS, maxRatio: 10_000 }, sink: memorySink().sink }),
      'suspicious-compression',
    );
  });

  it('detects tampered page bytes by CRC', async () => {
    const zip = zipSync({ 'p.jpg': [JPEG, { level: 0 }] });
    u32(zip, cdEntryOffset(zip, 0) + 16, 0xdeadbeef);
    await expectImportError(importCbz({ id: 'x', file: picked('t.cbz', zip), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'corrupt');
  });

  it('enforces file, page, pixel and entry-count limits', async () => {
    const tight: ImportLimits = { ...DEFAULT_LIMITS, maxFileBytes: 1000 };
    await expectImportError(importCbz({ id: 'x', file: picked('a.cbz', zipSync({ 'a.jpg': JPEG })), now: NOW, limits: tight, sink: memorySink().sink }), 'too-large');
    await expectImportError(
      importCbz({ id: 'x', file: picked('a.cbz', zipSync({ 'a.jpg': JPEG })), now: NOW, limits: { ...DEFAULT_LIMITS, maxPageBytes: 1000 }, sink: memorySink().sink }),
      'page-too-large',
    );
    await expectImportError(
      importCbz({ id: 'x', file: picked('a.cbz', zipSync({ 'a.png': png(20000, 20000) })), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }),
      'image-too-large',
    );
    const many: Record<string, Uint8Array> = {};
    for (let i = 0; i < 12; i++) many[`f${i}.txt`] = new Uint8Array([i]);
    await expectImportError(
      importCbz({ id: 'x', file: picked('a.cbz', zipSync(many)), now: NOW, limits: { ...DEFAULT_LIMITS, maxEntries: 10 }, sink: memorySink().sink }),
      'too-many-entries',
    );
    const pages: Record<string, Uint8Array> = {};
    for (let i = 0; i < 4; i++) pages[`${i}.png`] = png(10, 10);
    await expectImportError(
      importCbz({ id: 'x', file: picked('a.cbz', zipSync(pages)), now: NOW, limits: { ...DEFAULT_LIMITS, maxPages: 3 }, sink: memorySink().sink }),
      'too-many-pages',
    );
  });

  it('rejects encrypted entries, RAR files, empty archives and garbage', async () => {
    const zip = zipSync({ 'a.jpg': JPEG });
    zip[cdEntryOffset(zip, 0) + 8] |= 1;
    await expectImportError(importCbz({ id: 'x', file: picked('a.cbz', zip), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'encrypted');
    const rar = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0, 0, 0]);
    await expectImportError(importCbz({ id: 'x', file: picked('a.cbr', rar), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'cbr-unsupported');
    await expectImportError(importCbz({ id: 'x', file: picked('a.cbz', zipSync({ 'a.txt': new Uint8Array([1]) })), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'empty');
    const truncated = zipSync({ 'a.jpg': JPEG }).slice(0, 2000);
    await expectImportError(importCbz({ id: 'x', file: picked('a.cbz', truncated), now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'corrupt');
  });

  it('reads the central directory exactly', () => {
    const zip = zipSync({ 'b.jpg': JPEG, 'a/c.png': png(2, 2) });
    const entries = readCentralDirectory(zip, DEFAULT_LIMITS);
    expect(entries.map((e) => [e.name, e.size, e.crc])).toEqual([
      ['b.jpg', JPEG.length, crc32(JPEG)],
      ['a/c.png', 33, crc32(png(2, 2))],
    ]);
    expect(deflateSync(new Uint8Array(1)).length).toBeGreaterThan(0);
  });
});

describe('image import', () => {
  it('orders images naturally and titles the comic from shared file names', async () => {
    const { sink } = memorySink();
    const out = await importImages({
      id: 'i',
      files: [picked('Saga 01 p10.jpg', JPEG), picked('Saga 01 p2.png', png(500, 700)), picked('Saga 01 p1.jpg', JPEG)],
      now: NOW,
      limits: DEFAULT_LIMITS,
      sink,
    });
    expect(out.publication.title).toBe('Saga 01');
    expect(out.publication.pages.map((p) => p.width)).toEqual([1024, 500, 1024]);
    expect(out.publication.format).toBe('images');
  });

  it('skips files whose content is not an image and fails when none are', async () => {
    const fake = new TextEncoder().encode('GIF89a nope');
    const ok = await importImages({ id: 'i', files: [picked('a.jpg', JPEG), picked('b.jpg', fake)], now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink });
    expect(ok.skipped).toBe(1);
    await expectImportError(importImages({ id: 'i', files: [picked('b.jpg', fake)], now: NOW, limits: DEFAULT_LIMITS, sink: memorySink().sink }), 'empty');
  });
});

describe('metadata helpers', () => {
  it('parses ComicInfo safely and ignores entity declarations', () => {
    expect(parseComicInfo('<ComicInfo><Series>X</Series><Number>1</Number></ComicInfo>')).toEqual({ series: 'X', number: '1', title: undefined, writer: undefined, direction: undefined });
    expect(parseComicInfo('<!DOCTYPE x [<!ENTITY a "aaaa">]><ComicInfo><Title>&a;</Title></ComicInfo>')).toEqual({});
    expect(displayTitle({}, 'my_comic_vol-2.cbz')).toBe('my comic vol-2');
    expect(displayTitle({ series: 'Saga', number: '4' }, 'x.cbz')).toBe('Saga #4');
  });

  it('sorts naturally and finds common titles', () => {
    expect(['p10', 'p2', 'P1', 'p1a'].sort(naturalCompare)).toEqual(['P1', 'p1a', 'p2', 'p10']);
    expect(commonTitle(['Saga 01 p1.jpg', 'Saga 01 p2.jpg'])).toBe('Saga 01');
    expect(commonTitle(['a.jpg', 'b.jpg'])).toBe('Imported images');
  });
});
