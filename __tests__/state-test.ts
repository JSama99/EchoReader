import { chapters } from '@/content/catalog';
import { initialState, migrate, reduce } from '@/state/model';
import { createStore } from '@/state/store';

const P = (chapter: number, page: number, panel: number) => ({ chapter, page, panel });
const NOW = Date.parse('2026-11-27T15:00:00Z');

describe('reader state', () => {
  it('furthest never moves backwards while current follows the reader', () => {
    let s = reduce(initialState, { type: 'advance', seriesId: 'fs', position: P(1, 1, 2) });
    s = reduce(s, { type: 'advance', seriesId: 'fs', position: P(1, 0, 0) });
    expect(s.current.fs).toEqual(P(1, 0, 0));
    expect(s.furthest.fs).toEqual(P(1, 1, 2));
  });

  it('finishing a chapter earns at most one ember per week and only once per chapter', () => {
    let s = { ...initialState, embers: 0 };
    s = reduce(s, { type: 'finishChapter', chapterId: 'a', now: NOW });
    expect(s.embers).toBe(1);
    s = reduce(s, { type: 'finishChapter', chapterId: 'a', now: NOW + 8 * 86400_000 });
    expect(s.embers).toBe(1);
    s = reduce(s, { type: 'finishChapter', chapterId: 'b', now: NOW + 3600_000 });
    expect(s.embers).toBe(1);
    s = reduce(s, { type: 'finishChapter', chapterId: 'c', now: NOW + 8 * 86400_000 });
    expect(s.embers).toBe(2);
  });

  it('spending an ember unlocks an early chapter and is a no-op otherwise', () => {
    const ch2 = chapters.find((c) => c.id === 'flame-sigil-2')!;
    const s = reduce({ ...initialState, embers: 1 }, { type: 'spendEmber', chapter: ch2, now: NOW });
    expect(s.embers).toBe(0);
    expect(s.unlockedChapterIds).toContain('flame-sigil-2');
    expect(reduce(s, { type: 'spendEmber', chapter: ch2, now: NOW })).toBe(s);
  });

  it('remembers a mode per series or sets the global default', () => {
    let s = reduce(initialState, { type: 'setMode', seriesId: 'fs', mode: 'scroll', remember: true });
    expect(s.seriesModes.fs).toBe('scroll');
    s = reduce(s, { type: 'setMode', seriesId: 'fs', mode: 'pages', remember: false });
    expect(s.seriesModes.fs).toBeUndefined();
    expect(s.globalMode).toBe('pages');
  });

  it('celebrates each fragment exactly once', () => {
    const a = reduce(initialState, { type: 'celebrate', fragmentId: 'f1' });
    expect(reduce(a, { type: 'celebrate', fragmentId: 'f1' })).toBe(a);
  });

  it('migrates unknown or old storage to a valid state', () => {
    expect(migrate(null)).toEqual(initialState);
    expect(migrate({ version: 99 })).toEqual(initialState);
    expect(migrate({ version: 1, embers: 4 }).embers).toBe(4);
    expect(migrate({ version: 1 }).echoEnabled).toBe(true);
  });
});

describe('persistent store', () => {
  const memoryKv = () => {
    const m = new Map<string, string>();
    return {
      map: m,
      getItem: async (k: string) => m.get(k) ?? null,
      setItem: async (k: string, v: string) => void m.set(k, v),
    };
  };
  const tick = () => new Promise((r) => setTimeout(r, 1));

  it('hydrates, persists and notifies subscribers', async () => {
    const kv = memoryKv();
    const a = createStore(kv);
    await a.hydrate();
    const seen: number[] = [];
    a.subscribe(() => seen.push(a.getState().embers));
    a.dispatch({ type: 'set', patch: { scoreEnabled: true } });
    a.dispatch({ type: 'finishChapter', chapterId: 'x', now: NOW });
    await tick();
    expect(seen.length).toBe(2);

    const b = createStore(kv);
    await b.hydrate();
    expect(b.getState().scoreEnabled).toBe(true);
    expect(b.getState().finishedChapterIds).toEqual(['x']);
  });

  it('survives corrupt storage', async () => {
    const kv = memoryKv();
    kv.map.set('echoreader.state.v1', '{not json');
    const s = createStore(kv);
    await s.hydrate();
    expect(s.ready()).toBe(true);
    expect(s.getState()).toEqual(initialState);
  });

  it('does not notify on no-op actions', async () => {
    const s = createStore(memoryKv());
    await s.hydrate();
    s.dispatch({ type: 'celebrate', fragmentId: 'f' });
    let calls = 0;
    s.subscribe(() => calls++);
    s.dispatch({ type: 'celebrate', fragmentId: 'f' });
    expect(calls).toBe(0);
  });
});
