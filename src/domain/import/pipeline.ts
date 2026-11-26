import type { ImportFormat, LocalPage, LocalPublication } from '../library';
import type { ReadingDirection } from '../types';

import { checkImage, naturalCompare, planArchive, readCentralDirectory, readComicInfo, extractEntry } from './cbz';
import { displayTitle, titleFromFileName, type ComicInfo } from './comicinfo';
import { ImportError, type ImportLimits } from './limits';
import { extensionFor, sniff } from './sniff';

/**
 * Platform-independent import pipeline. The device layer supplies picked
 * files as bytes and a sink that stores page files; everything about
 * validation, ordering and metadata happens here and is unit-tested.
 */

export type PickedFile = { name: string; size: number; read: () => Promise<Uint8Array> };

export type PageSink = {
  /** Store one page; returns the stored file name relative to the comic's folder. */
  write(index: number, bytes: Uint8Array, ext: string): Promise<string>;
};

export type Progress = (done: number, total: number) => void;

export type ImportOutcome = {
  publication: LocalPublication;
  /** Images inside the archive that were skipped because their content wasn't a supported image. */
  skipped: number;
};

const pageId = (i: number) => `p${String(i + 1).padStart(4, '0')}`;

/** Route picked files to the right importer. Several images make one comic. */
export function classify(files: { name: string; head: Uint8Array }[]): ImportFormat | 'rar' {
  const kinds = files.map((f) => sniff(f.head));
  if (files.length === 1 && kinds[0] === 'zip') return 'cbz';
  if (files.length === 1 && kinds[0] === 'pdf') return 'pdf';
  if (files.length === 1 && kinds[0] === 'rar') return 'rar';
  if (kinds.every((k) => k === 'jpeg' || k === 'png' || k === 'webp')) return 'images';
  throw new ImportError('unsupported', kinds.join(','));
}

export async function importCbz(
  args: { id: string; file: PickedFile; now: number; limits: ImportLimits; sink: PageSink; onProgress?: Progress },
): Promise<ImportOutcome> {
  const { file, limits, sink } = args;
  if (file.size > limits.maxFileBytes) throw new ImportError('too-large', `${file.size} bytes`);
  const bytes = await file.read();
  if (bytes.length > limits.maxFileBytes) throw new ImportError('too-large', `${bytes.length} bytes`);
  if (sniff(bytes) !== 'zip') throw new ImportError(sniff(bytes) === 'rar' ? 'cbr-unsupported' : 'unsupported', 'Not a ZIP archive');

  const plan = planArchive(readCentralDirectory(bytes, limits), limits);
  const info = readComicInfo(bytes, plan);
  const pages: LocalPage[] = [];
  let skipped = 0;

  for (let i = 0; i < plan.pages.length; i++) {
    const data = extractEntry(bytes, plan.pages[i]);
    const img = checkImage(data, limits);
    if (!img) {
      skipped++;
      continue;
    }
    const index = pages.length;
    const stored = await sink.write(index, data, extensionFor[img.kind]);
    pages.push({ id: pageId(index), file: stored, width: img.width, height: img.height });
    args.onProgress?.(i + 1, plan.pages.length);
  }
  if (pages.length === 0) throw new ImportError('empty', 'No readable images');
  return { publication: publication(args.id, 'cbz', file, info, pages, args.now), skipped };
}

export async function importImages(
  args: { id: string; files: PickedFile[]; now: number; limits: ImportLimits; sink: PageSink; onProgress?: Progress },
): Promise<ImportOutcome> {
  const { limits, sink } = args;
  if (args.files.length > limits.maxPages) throw new ImportError('too-many-pages', `${args.files.length} images`);
  const total = args.files.reduce((n, f) => n + f.size, 0);
  if (total > limits.maxTotalBytes) throw new ImportError('total-too-large', `${total} bytes`);
  const ordered = [...args.files].sort((a, b) => naturalCompare(a.name, b.name));
  const pages: LocalPage[] = [];
  let skipped = 0;
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    if (f.size > limits.maxPageBytes) throw new ImportError('page-too-large', f.name);
    const data = await f.read();
    if (data.length > limits.maxPageBytes) throw new ImportError('page-too-large', f.name);
    const img = checkImage(data, limits);
    if (!img) {
      skipped++;
      continue;
    }
    const index = pages.length;
    const stored = await sink.write(index, data, extensionFor[img.kind]);
    pages.push({ id: pageId(index), file: stored, width: img.width, height: img.height });
    args.onProgress?.(i + 1, ordered.length);
  }
  if (pages.length === 0) throw new ImportError('empty', 'No readable images');
  const name = ordered.length === 1 ? ordered[0].name : commonTitle(ordered.map((f) => f.name));
  return { publication: publication(args.id, 'images', { name, size: total }, {}, pages, args.now), skipped };
}

/** Assemble a PDF publication from pages a native renderer already wrote. */
export function pdfPublication(id: string, file: { name: string; size: number }, pages: LocalPage[], now: number): LocalPublication {
  if (pages.length === 0) throw new ImportError('empty', 'PDF has no pages');
  return publication(id, 'pdf', file, {}, pages, now);
}

function publication(
  id: string,
  format: ImportFormat,
  file: { name: string; size: number },
  info: ComicInfo,
  pages: LocalPage[],
  now: number,
): LocalPublication {
  const direction: ReadingDirection = info.direction ?? 'ltr';
  return {
    id,
    title: displayTitle(info, file.name),
    author: info.writer,
    seriesName: info.series,
    number: info.number,
    format,
    importedAt: new Date(now).toISOString(),
    sizeBytes: file.size,
    direction,
    pages,
    coverPage: 0,
  };
}

/** "Saga 01 p1.jpg", "Saga 01 p2.jpg" → "Saga 01". */
export function commonTitle(names: string[]): string {
  const bases = names.map((n) => titleFromFileName(n));
  let prefix = bases[0] ?? '';
  for (const b of bases) while (!b.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const cleaned = prefix.replace(/[\s\-_.(#]*(p|pg|page)?\s*\d*$/i, '').trim();
  return cleaned.length >= 2 ? cleaned : 'Imported images';
}
