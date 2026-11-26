import type { Chapter, Page, Position, ReadingDirection } from './types';

/**
 * Personal library: comics the reader imported from their own device. Files
 * stay on the device; nothing here is uploaded anywhere.
 */

export type ImportFormat = 'cbz' | 'pdf' | 'images';

export type LocalPage = { id: string; file: string; width: number; height: number };

export type LocalPublication = {
  id: string;
  title: string;
  author?: string;
  seriesName?: string;
  number?: string;
  format: ImportFormat;
  importedAt: string;
  sizeBytes: number;
  direction: ReadingDirection;
  pages: LocalPage[];
  coverPage: number;
};

export type Collection = { id: string; name: string; createdAt: string; itemKeys: string[] };

/** Progress key for an imported comic (series ids never contain ':'). */
export const localKey = (id: string) => `local:${id}`;
export const isLocalKey = (key: string) => key.startsWith('local:');
export const localIdOf = (key: string) => key.slice('local:'.length);

/** Adapt an imported comic to the reader's chapter shape. */
export function chapterFromLocal(pub: LocalPublication, resolve: (file: string) => string): Chapter {
  const pages: Page[] = pub.pages.map((p, i) => ({
    id: `${pub.id}:${p.id}`,
    src: resolve(p.file),
    label: String(i + 1),
    width: p.width,
    height: p.height,
    panels: [],
    glyphs: [],
  }));
  return {
    id: localKey(pub.id),
    seriesId: localKey(pub.id),
    number: 1,
    title: pub.title,
    contentStatus: 'complete',
    pages,
    credits: pub.author ? [{ role: 'Author', name: pub.author }] : [],
  };
}

export type Bookmark = { id: string; key: string; chapterId: string; page: number; createdAt: string };
export type HistoryEntry = { key: string; chapterId: string; at: string };

export type ShelfItem = {
  key: string;
  kind: 'series' | 'local';
  title: string;
  addedAt?: string;
  lastReadAt?: string;
  progress: number;
  completed: boolean;
  favorite: boolean;
  purchased: boolean;
};

export type Shelves = {
  continueReading: ShelfItem[];
  recentlyAdded: ShelfItem[];
  favorites: ShelfItem[];
  completed: ShelfItem[];
  unread: ShelfItem[];
  imported: ShelfItem[];
  purchased: ShelfItem[];
  collections: { collection: Collection; items: ShelfItem[] }[];
};

/** Fraction of pages reached for a single-chapter item. */
export function pageProgress(furthest: Position | undefined, pageCount: number): number {
  if (!furthest || furthest.chapter < 0 || pageCount === 0) return 0;
  return Math.min(1, (furthest.page + 1) / pageCount);
}

/** Build every shelf from flat items. Pure, so the library screen is tested. */
export function buildShelves(items: ShelfItem[], collections: Collection[]): Shelves {
  const byRecent = (a: ShelfItem, b: ShelfItem) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '');
  const byAdded = (a: ShelfItem, b: ShelfItem) => (b.addedAt ?? '').localeCompare(a.addedAt ?? '');
  return {
    continueReading: items.filter((i) => i.lastReadAt && !i.completed && i.progress > 0).sort(byRecent),
    recentlyAdded: items.filter((i) => i.addedAt).sort(byAdded).slice(0, 12),
    favorites: items.filter((i) => i.favorite),
    completed: items.filter((i) => i.completed),
    unread: items.filter((i) => i.progress === 0 && !i.completed),
    imported: items.filter((i) => i.kind === 'local').sort(byAdded),
    purchased: items.filter((i) => i.purchased),
    collections: collections.map((c) => ({ collection: c, items: c.itemKeys.map((k) => items.find((i) => i.key === k)).filter((x): x is ShelfItem => !!x) })),
  };
}
