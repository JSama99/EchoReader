/**
 * Import safety limits. Each one exists to stop a specific failure:
 * memory exhaustion, zip bombs, decompression of huge images, or a
 * pathological archive with thousands of tiny entries.
 */
export type ImportLimits = {
  /** Largest file accepted from the picker. CBZ files are read into memory. */
  maxFileBytes: number;
  /** Largest single page after decompression. */
  maxPageBytes: number;
  /** Total decompressed bytes written for one comic. */
  maxTotalBytes: number;
  /** Maximum pages per comic. */
  maxPages: number;
  /** Maximum entries scanned in an archive (including non-images). */
  maxEntries: number;
  /** Largest decoded image (width × height). Prevents decoder memory blowups. */
  maxPixels: number;
  /** Max decompressed/compressed ratio for one entry. Images barely compress, so bombs stand out. */
  maxRatio: number;
};

export const DEFAULT_LIMITS: ImportLimits = {
  maxFileBytes: 400 * 1024 * 1024,
  maxPageBytes: 40 * 1024 * 1024,
  maxTotalBytes: 1500 * 1024 * 1024,
  maxPages: 1500,
  maxEntries: 5000,
  maxPixels: 60_000_000,
  maxRatio: 50,
};

export type ImportErrorCode =
  | 'too-large'
  | 'unsupported'
  | 'cbr-unsupported'
  | 'pdf-unavailable'
  | 'corrupt'
  | 'empty'
  | 'too-many-entries'
  | 'too-many-pages'
  | 'page-too-large'
  | 'image-too-large'
  | 'suspicious-compression'
  | 'total-too-large'
  | 'encrypted'
  | 'unsafe-paths';

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export const IMPORT_ERROR_TEXT: Record<ImportErrorCode, string> = {
  'too-large': 'This file is larger than EchoReader can import safely.',
  unsupported: 'This file type isn’t supported. Try PDF, CBZ, JPEG, PNG or WebP.',
  'cbr-unsupported': 'CBR (RAR) comics aren’t supported yet. Convert the file to CBZ and import it again.',
  'pdf-unavailable': 'PDF import needs the EchoReader app for iPhone, iPad or Android.',
  corrupt: 'The file looks damaged and couldn’t be read.',
  empty: 'No comic pages were found in this file.',
  'too-many-entries': 'This archive has too many files to import safely.',
  'too-many-pages': 'This comic has more pages than EchoReader can import at once.',
  'page-too-large': 'A page in this comic is too large to import safely.',
  'image-too-large': 'A page has more pixels than EchoReader can display safely.',
  'suspicious-compression': 'This archive is compressed in a way that looks unsafe, so it wasn’t opened.',
  'total-too-large': 'This comic is too large once unpacked.',
  encrypted: 'This file is password-protected.',
  'unsafe-paths': 'This archive contains file paths that could be unsafe, so it wasn’t opened.',
};
