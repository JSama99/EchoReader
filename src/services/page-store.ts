import { Directory, File, Paths } from 'expo-file-system';

import type { PageSink } from '@/domain/import/pipeline';
import type { LocalPublication } from '@/domain/library';

/**
 * Imported comic pages on iOS/Android: one folder per comic under the app's
 * documents directory (backed up by the OS, never uploaded by EchoReader).
 */

const libraryDir = () => new Directory(Paths.document, 'library');
const comicDir = (id: string) => new Directory(libraryDir(), id);

export function sinkFor(id: string): PageSink & { abort(): void } {
  const dir = comicDir(id);
  if (!libraryDir().exists) libraryDir().create({ intermediates: true });
  if (!dir.exists) dir.create();
  return {
    async write(index, bytes, ext) {
      const name = `page-${String(index + 1).padStart(4, '0')}.${ext}`;
      const f = new File(dir, name);
      f.create({ overwrite: true });
      await f.write(bytes);
      return name;
    },
    abort() {
      if (dir.exists) dir.delete();
    },
  };
}

/** file:// URIs for every page; synchronous on native. */
export async function resolvePages(pub: LocalPublication): Promise<Record<string, string>> {
  const dir = comicDir(pub.id);
  return Object.fromEntries(pub.pages.map((p) => [p.file, new File(dir, p.file).uri]));
}

export function releasePages(_pub: LocalPublication) {}

export async function deletePublicationFiles(id: string): Promise<void> {
  const dir = comicDir(id);
  if (dir.exists) dir.delete();
}

export async function deleteAllPublicationFiles(): Promise<void> {
  const dir = libraryDir();
  if (dir.exists) dir.delete();
}

/** Directory for a comic, for native renderers (PDF) that write pages themselves. */
export function comicFolderUri(id: string): string {
  const dir = comicDir(id);
  if (!libraryDir().exists) libraryDir().create({ intermediates: true });
  if (!dir.exists) dir.create();
  return dir.uri;
}

export function pageFileSize(id: string, file: string): number {
  const f = new File(comicDir(id), file);
  return f.exists ? (f.size ?? 0) : 0;
}
