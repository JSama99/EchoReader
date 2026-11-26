import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { DEFAULT_LIMITS, IMPORT_ERROR_TEXT, ImportError, type ImportErrorCode } from '@/domain/import/limits';
import { classify, importCbz, importImages, pdfPublication, type ImportOutcome, type PickedFile, type Progress } from '@/domain/import/pipeline';
import type { LocalPage } from '@/domain/library';

import { EchoPdf } from '../../modules/echo-pdf';

import { comicFolderUri, deletePublicationFiles, sinkFor } from './page-store';

/**
 * Device side of importing: the system file picker, reading bytes, and
 * routing to the pure pipeline. Files are copied into app storage; nothing is
 * uploaded. The picker's temporary copies are deleted afterwards.
 */

export type ImportResult =
  | { status: 'imported'; outcome: ImportOutcome }
  | { status: 'cancelled' }
  | { status: 'failed'; code: ImportErrorCode; message: string };

type Asset = DocumentPicker.DocumentPickerAsset;

const isWeb = Platform.OS === 'web';

function picked(asset: Asset): PickedFile {
  return {
    name: asset.name,
    size: asset.size ?? asset.file?.size ?? 0,
    read: async () => {
      if (isWeb) return new Uint8Array(await asset.file!.arrayBuffer());
      return new File(asset.uri).bytes();
    },
  };
}

async function head(asset: Asset): Promise<Uint8Array> {
  if (isWeb) return new Uint8Array(await asset.file!.slice(0, 16).arrayBuffer());
  const handle = new File(asset.uri).open();
  try {
    return handle.readBytesSync(16);
  } finally {
    handle.close();
  }
}

function cleanupPicked(assets: Asset[]) {
  if (isWeb) return;
  for (const a of assets) {
    try {
      const f = new File(a.uri);
      if (f.exists) f.delete();
    } catch {
      // The OS cleans its cache eventually; never fail an import over this.
    }
  }
}

const PDF_MAX_WIDTH = 2048;
const PDF_MAX_PIXELS = 8_000_000;

async function importPdf(id: string, asset: Asset, now: number, onProgress?: Progress): Promise<ImportOutcome> {
  if (!EchoPdf) throw new ImportError('pdf-unavailable', 'Native PDF renderer not present');
  const size = asset.size ?? 0;
  if (size > DEFAULT_LIMITS.maxFileBytes) throw new ImportError('too-large', `${size} bytes`);
  let count: number;
  try {
    count = await EchoPdf.pageCount(asset.uri);
  } catch (e) {
    throw new ImportError(String(e).includes('password') ? 'encrypted' : 'corrupt', String(e));
  }
  if (count === 0) throw new ImportError('empty', 'PDF has no pages');
  if (count > DEFAULT_LIMITS.maxPages) throw new ImportError('too-many-pages', `${count} pages`);

  const folder = comicFolderUri(id);
  const pages: LocalPage[] = [];
  for (let i = 0; i < count; i++) {
    const file = `page-${String(i + 1).padStart(4, '0')}.jpg`;
    const { width, height } = await EchoPdf.renderPage(asset.uri, i, PDF_MAX_WIDTH, PDF_MAX_PIXELS, `${folder.replace(/\/$/, '')}/${file}`, 0.88);
    pages.push({ id: `p${String(i + 1).padStart(4, '0')}`, file, width, height });
    onProgress?.(i + 1, count);
  }
  return { publication: pdfPublication(id, { name: asset.name, size }, pages, now), skipped: 0 };
}

/** Open the system picker and import what the reader chooses. */
export async function pickAndImport(onProgress?: Progress): Promise<ImportResult> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
  if (res.canceled || res.assets.length === 0) return { status: 'cancelled' };
  return importAssets(res.assets, onProgress);
}

export async function importAssets(assets: Asset[], onProgress?: Progress): Promise<ImportResult> {
  const id = Crypto.randomUUID();
  const sink = sinkFor(id);
  const now = Date.now();
  try {
    const heads = await Promise.all(assets.map(async (a) => ({ name: a.name, head: await head(a) })));
    const kind = classify(heads);
    let outcome: ImportOutcome;
    if (kind === 'rar') throw new ImportError('cbr-unsupported', 'RAR archive');
    else if (kind === 'cbz') outcome = await importCbz({ id, file: picked(assets[0]), now, limits: DEFAULT_LIMITS, sink, onProgress });
    else if (kind === 'pdf') outcome = await importPdf(id, assets[0], now, onProgress);
    else outcome = await importImages({ id, files: assets.map(picked), now, limits: DEFAULT_LIMITS, sink, onProgress });
    return { status: 'imported', outcome };
  } catch (e) {
    sink.abort();
    await deletePublicationFiles(id).catch(() => {});
    const code: ImportErrorCode = e instanceof ImportError ? e.code : 'corrupt';
    return { status: 'failed', code, message: IMPORT_ERROR_TEXT[code] };
  } finally {
    cleanupPicked(assets);
  }
}

export { deletePublicationFiles };
