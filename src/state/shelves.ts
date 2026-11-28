import { chaptersOf, getChapter, getSeries } from '@/content/catalog';
import { localKey, type ShelfItem } from '@/domain/library';

import { localProgress } from './derived';
import type { ReaderState } from './model';

/** Shelf items from state: followed/favorite/started series plus every imported comic. */
export function shelfItems(s: ReaderState): ShelfItem[] {
  const lastRead = (key: string) => s.history.find((h) => h.key === key)?.at;
  const series = new Set([...s.following, ...s.favorites.filter((k) => !k.startsWith('local:')), ...Object.keys(s.furthest).filter((k) => !k.startsWith('local:'))]);
  const fromSeries: ShelfItem[] = [...series]
    .map((id) => getSeries(id))
    .filter((x): x is NonNullable<typeof x> => !!x && x.status === 'live')
    .map((x) => {
      const readable = chaptersOf(x.id).filter((c) => c.pages.length > 0);
      const done = readable.filter((c) => s.finishedChapterIds.includes(c.id)).length;
      const started = readable.some((c) => s.history.some((h) => h.chapterId === c.id));
      return {
        key: x.id,
        kind: 'series',
        title: x.title,
        lastReadAt: lastRead(x.id),
        progress: readable.length ? (done + (started && done < readable.length ? 0.5 : 0)) / readable.length : 0,
        completed: readable.length > 0 && done === readable.length,
        favorite: s.favorites.includes(x.id),
        purchased: s.commerce.entitlements.some((e) => e.source === 'purchase' && e.status === 'active' && getChapter(e.chapterId)?.seriesId === x.id),
      };
    });
  const fromLocal: ShelfItem[] = s.library.map((p) => {
    const key = localKey(p.id);
    const progress = localProgress(s, p);
    return {
      key,
      kind: 'local',
      title: p.title,
      addedAt: p.importedAt,
      lastReadAt: lastRead(key),
      progress,
      completed: s.finishedChapterIds.includes(key) || progress >= 1,
      favorite: s.favorites.includes(key),
      purchased: false,
    };
  });
  return [...fromSeries, ...fromLocal];
}

