import type { PageSink } from '@/domain/import/pipeline';
import type { LocalPublication } from '@/domain/library';

/**
 * Imported comic pages on web: Blobs in IndexedDB (key `${comicId}/${file}`),
 * served to <img> through object URLs. Nothing leaves the browser.
 */

const DB = 'echoreader-library';
const STORE = 'pages';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export function sinkFor(id: string): PageSink & { abort(): void } {
  const written: string[] = [];
  return {
    async write(index, bytes, ext) {
      const name = `page-${String(index + 1).padStart(4, '0')}.${ext}`;
      const blob = new Blob([bytes as BlobPart], { type: MIME[ext] ?? 'application/octet-stream' });
      await tx('readwrite', (s) => s.put(blob, `${id}/${name}`));
      written.push(name);
      return name;
    },
    abort() {
      void tx('readwrite', (s) => {
        written.forEach((n) => s.delete(`${id}/${n}`));
      });
    },
  };
}

const urls = new Map<string, Record<string, string>>();

export async function resolvePages(pub: LocalPublication): Promise<Record<string, string>> {
  const hit = urls.get(pub.id);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const p of pub.pages) {
    const blob = await tx<Blob>('readonly', (s) => s.get(`${pub.id}/${p.file}`));
    if (blob) out[p.file] = URL.createObjectURL(blob);
  }
  urls.set(pub.id, out);
  return out;
}

export function releasePages(pub: LocalPublication) {
  const hit = urls.get(pub.id);
  if (hit) Object.values(hit).forEach((u) => URL.revokeObjectURL(u));
  urls.delete(pub.id);
}

export async function deletePublicationFiles(id: string): Promise<void> {
  urls.delete(id);
  await tx('readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`)));
}

export async function deleteAllPublicationFiles(): Promise<void> {
  urls.clear();
  await tx('readwrite', (s) => s.clear());
}

export function comicFolderUri(_id: string): string {
  throw new Error('PDF rendering is not available on web');
}

export function pageFileSize(_id: string, _file: string): number {
  return 0;
}
