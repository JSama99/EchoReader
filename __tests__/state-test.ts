import { balance } from '@/domain/rewards';
import { initialState, isoWeekStart, migrate, reduce, type ReaderState } from '@/state/model';
import { createStore } from '@/state/store';

const P = (chapter: number, page: number, panel: number) => ({ chapter, page, panel });
const NOW = Date.parse('2026-11-27T15:00:00Z');

describe('reader state', () => {
  it('furthest never moves backwards while current follows the reader', () => {
    let s = reduce(initialState, { type: 'advance', seriesId: 'fs', position: P(1, 1, 2), now: NOW });
    s = reduce(s, { type: 'advance', seriesId: 'fs', position: P(1, 0, 0), now: NOW + 1000 });
    expect(s.current.fs).toEqual(P(1, 0, 0));
    expect(s.furthest.fs).toEqual(P(1, 1, 2));
    expect(s.currentAt.fs).toBe(new Date(NOW + 1000).toISOString());
    expect(s.readingDays).toEqual(['2026-11-27']);
  });

  const embers = (s: ReaderState) => balance(s.rewards);

  it('finishing a chapter earns at most one ember per week and only once per chapter', () => {
    let s: ReaderState = { ...initialState, rewards: { events: [], redemptions: [] } };
    s = reduce(s, { type: 'finishChapter', chapterId: 'a', now: NOW });
    expect(embers(s)).toBe(1);
    s = reduce(s, { type: 'finishChapter', chapterId: 'a', now: NOW + 8 * 86400_000 });
    expect(embers(s)).toBe(1);
    s = reduce(s, { type: 'finishChapter', chapterId: 'b', now: NOW + 3600_000 });
    expect(embers(s)).toBe(1);
    s = reduce(s, { type: 'finishChapter', chapterId: 'c', now: NOW + 8 * 86400_000 });
    expect(embers(s)).toBe(2);
  });

  it('never rewards finishing an imported comic', () => {
    const s = reduce({ ...initialState, rewards: { events: [], redemptions: [] } }, { type: 'finishChapter', chapterId: 'local:abc', now: NOW });
    expect(s.finishedChapterIds).toEqual(['local:abc']);
    expect(embers(s)).toBe(0);
  });

  it('rewards each glyph discovery once', () => {
    let s = reduce(initialState, { type: 'discoverGlyph', glyphId: 'g1', now: NOW });
    expect(embers(s)).toBe(2);
    const again = reduce(s, { type: 'discoverGlyph', glyphId: 'g1', now: NOW });
    expect(again).toBe(s);
    s = reduce(s, { type: 'discoverGlyph', glyphId: 'g2', now: NOW });
    expect(embers(s)).toBe(3);
  });

  it('toggles bookmarks per page and keeps history newest-first without duplicates', () => {
    let s = reduce(initialState, { type: 'toggleBookmark', key: 'fs', chapterId: 'c1', page: 2, now: NOW });
    expect(s.bookmarks).toHaveLength(1);
    s = reduce(s, { type: 'toggleBookmark', key: 'fs', chapterId: 'c1', page: 2, now: NOW });
    expect(s.bookmarks).toHaveLength(0);
    s = reduce(s, { type: 'opened', key: 'fs', chapterId: 'c1', now: NOW });
    s = reduce(s, { type: 'opened', key: 'local:x', chapterId: 'local:x', now: NOW + 1 });
    s = reduce(s, { type: 'opened', key: 'fs', chapterId: 'c1', now: NOW + 2 });
    expect(s.history.map((h) => h.chapterId)).toEqual(['c1', 'local:x']);
  });

  it('removing an imported comic removes its progress, bookmarks and collection membership', () => {
    const pub = { id: 'abc', title: 'Mine', format: 'cbz' as const, importedAt: '2026-11-26T00:00:00Z', sizeBytes: 10, direction: 'ltr' as const, pages: [], coverPage: 0 };
    let s = reduce(initialState, { type: 'addPublication', publication: pub });
    expect(reduce(s, { type: 'addPublication', publication: pub })).toBe(s);
    s = reduce(s, { type: 'advance', seriesId: 'local:abc', position: P(1, 3, 0), now: NOW });
    s = reduce(s, { type: 'toggleBookmark', key: 'local:abc', chapterId: 'local:abc', page: 3, now: NOW });
    s = reduce(s, { type: 'createCollection', id: 'k', name: '  Favorites  ', now: NOW });
    s = reduce(s, { type: 'toggleInCollection', collectionId: 'k', key: 'local:abc' });
    expect(s.collections[0]).toMatchObject({ name: 'Favorites', itemKeys: ['local:abc'] });
    s = reduce(s, { type: 'removePublication', id: 'abc' });
    expect(s.library).toEqual([]);
    expect(s.furthest['local:abc']).toBeUndefined();
    expect(s.bookmarks).toEqual([]);
    expect(s.collections[0].itemKeys).toEqual([]);
  });

  it('rejects empty collection names', () => {
    expect(reduce(initialState, { type: 'createCollection', id: 'k', name: '   ', now: NOW })).toBe(initialState);
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

  it('migrates unknown storage to a valid state', () => {
    expect(migrate(null)).toEqual(initialState);
    expect(migrate({ version: 99 })).toEqual(initialState);
    expect(migrate({ version: 2, echoEnabled: false }).echoEnabled).toBe(false);
  });

  it('migrates v1: keeps the Ember balance, returns early-access Embers, keeps the weekly cap', () => {
    const v1 = {
      version: 1,
      onboarded: true,
      embers: 4,
      unlockedChapterIds: ['flame-sigil-2'],
      rewardedWeeks: ['2026-W48'],
      finishedChapterIds: ['flame-sigil-1'],
      furthest: { 'flame-sigil': P(1, 1, 3) },
      clearAfterDays: 7,
    };
    const s = migrate(v1);
    expect(s.version).toBe(2);
    expect(s.onboarded).toBe(true);
    expect(balance(s.rewards)).toBe(5);
    expect(s.furthest['flame-sigil']).toEqual(P(1, 1, 3));
    expect('clearAfterDays' in s).toBe(false);
    // Already rewarded this week in v1: finishing another chapter the same week earns nothing.
    const after = reduce(s, { type: 'finishChapter', chapterId: 'x', now: Date.parse('2026-11-27T10:00:00Z') });
    expect(balance(after.rewards)).toBe(5);
    expect(isoWeekStart('2026-W48')).toBe('2026-11-23T00:00:00.000Z');
    expect(isoWeekStart('2020-W53')).toBe('2020-12-28T00:00:00.000Z');
  });

  it('applies purchases idempotently through the reducer', () => {
    const edition = {
      id: 'e1', chapterId: 'c', tier: 'standard' as const, title: 'Standard', price: { amountMinor: 499, currency: 'USD' },
      productIds: {}, benefits: [], includesReading: true as const, collectible: null, onSale: true,
    };
    const tx = {
      id: 't1', productId: 'p', editionId: 'e1', chapterId: 'c', status: 'completed' as const, amount: edition.price,
      createdAt: '2026-11-26T00:00:00Z', updatedAt: '2026-11-26T00:00:00Z', environment: 'sandbox' as const, verification: 'sandbox' as const,
    };
    const a = reduce(initialState, { type: 'applyTransactions', transactions: [tx], editions: [edition] });
    expect(a.commerce.entitlements).toHaveLength(1);
    expect(reduce(a, { type: 'applyTransactions', transactions: [tx], editions: [edition] })).toBe(a);
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
    a.subscribe(() => seen.push(a.getState().rewards.events.length));
    a.dispatch({ type: 'set', patch: { readerTheme: 'light' } });
    a.dispatch({ type: 'finishChapter', chapterId: 'x', now: NOW });
    await tick();
    expect(seen.length).toBe(2);

    const b = createStore(kv);
    await b.hydrate();
    expect(b.getState().readerTheme).toBe('light');
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
