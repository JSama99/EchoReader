import { earnedAchievements } from '@/domain/achievements';
import { envelope, enqueue, pageBucket, sanitize } from '@/domain/analytics';
import { has, IMPORTED_CAPABILITIES, modesFor, supportedMode } from '@/domain/capabilities';
import { buildShelves, chapterFromLocal, chapterName, localKey, pageProgress, type LocalPublication, type ShelfItem } from '@/domain/library';
import { chapterProgress, nextStep, prevStep } from '@/domain/sigil';
import { fitPage } from '@/domain/fit';

const pub: LocalPublication = {
  id: 'abc',
  title: 'My Comic',
  author: 'Me',
  format: 'cbz',
  importedAt: '2026-11-26T00:00:00Z',
  sizeBytes: 100,
  direction: 'rtl',
  coverPage: 0,
  pages: [
    { id: 'p0001', file: 'page-0001.jpg', width: 800, height: 1200 },
    { id: 'p0002', file: 'page-0002.png', width: 1600, height: 1200 },
  ],
};

describe('core reader without publication metadata', () => {
  it('adapts an imported comic with no panels, glyphs or Echo data', () => {
    const ch = chapterFromLocal(pub, (f) => `file:///lib/abc/${f}`);
    expect(ch.id).toBe('local:abc');
    expect(ch.pages.map((p) => [p.src, p.panels.length, p.glyphs.length])).toEqual([
      ['file:///lib/abc/page-0001.jpg', 0, 0],
      ['file:///lib/abc/page-0002.png', 0, 0],
    ]);
    expect(ch.credits).toEqual([{ role: 'Author', name: 'Me' }]);
  });

  it('steps page by page when there are no panels', () => {
    const pages = chapterFromLocal(pub, (f) => f).pages;
    expect(nextStep(pages, { page: 0, panel: 0 })).toEqual({ page: 1, panel: 0 });
    expect(nextStep(pages, { page: 1, panel: 0 })).toBeNull();
    expect(prevStep(pages, { page: 1, panel: 0 })).toEqual({ page: 0, panel: 0 });
    expect(chapterProgress(pages, { page: 1, panel: 0 })).toBeGreaterThan(0.5);
  });

  it('offers Sigil View only where panels are authored', () => {
    expect(modesFor(IMPORTED_CAPABILITIES)).toEqual(['scroll', 'pages']);
    expect(modesFor(['standard', 'sigil'])).toEqual(['sigil', 'scroll', 'pages']);
    expect(supportedMode('sigil', IMPORTED_CAPABILITIES)).toBe('pages');
    expect(supportedMode('scroll', IMPORTED_CAPABILITIES)).toBe('scroll');
    expect(has(IMPORTED_CAPABILITIES, 'echo')).toBe(false);
  });

  it('fits pages by page, width and height', () => {
    const vp = { width: 400, height: 800 };
    expect(fitPage({ width: 800, height: 1200 }, vp, 'width', 0)).toEqual({ width: 400, height: 600 });
    expect(fitPage({ width: 800, height: 1200 }, vp, 'height', 0)).toEqual({ width: 800 * (800 / 1200), height: 800 });
    const page = fitPage({ width: 800, height: 1200 }, vp, 'page', 16);
    expect(page.width).toBeCloseTo(368);
    expect(page.height).toBeCloseTo(552);
  });
});

describe('library shelves', () => {
  const item = (over: Partial<ShelfItem>): ShelfItem => ({ key: 'k', kind: 'local', title: 't', progress: 0, completed: false, favorite: false, purchased: false, ...over });

  it('sorts and filters every shelf', () => {
    const items = [
      item({ key: 'a', addedAt: '2026-11-01', lastReadAt: '2026-11-20', progress: 0.4 }),
      item({ key: 'b', addedAt: '2026-11-10', progress: 0 }),
      item({ key: 'c', addedAt: '2026-11-05', lastReadAt: '2026-11-25', progress: 1, completed: true, favorite: true }),
      item({ key: 'fs', kind: 'series', lastReadAt: '2026-11-26', progress: 0.5, purchased: true }),
    ];
    const s = buildShelves(items, [{ id: 'col', name: 'Mine', createdAt: '', itemKeys: ['c', 'gone'] }]);
    expect(s.continueReading.map((i) => i.key)).toEqual(['fs', 'a']);
    expect(s.recentlyAdded.map((i) => i.key)).toEqual(['b', 'c', 'a']);
    expect(s.unread.map((i) => i.key)).toEqual(['b']);
    expect(s.completed.map((i) => i.key)).toEqual(['c']);
    expect(s.favorites.map((i) => i.key)).toEqual(['c']);
    expect(s.imported.map((i) => i.key)).toEqual(['b', 'c', 'a']);
    expect(s.purchased.map((i) => i.key)).toEqual(['fs']);
    expect(s.collections[0].items.map((i) => i.key)).toEqual(['c']);
  });

  it('names chapters without repeating a label that equals the title', () => {
    expect(chapterName({ label: 'Prologue', title: 'Prologue' })).toBe('Prologue');
    expect(chapterName({ label: 'Chapter One', title: 'Signal Lost' })).toBe('Chapter One · Signal Lost');
    expect(chapterName({ title: 'My Comic' })).toBe('My Comic');
  });

  it('computes page progress', () => {
    expect(pageProgress(undefined, 10)).toBe(0);
    expect(pageProgress({ chapter: 1, page: 4, panel: 0 }, 10)).toBe(0.5);
    expect(localKey('x')).toBe('local:x');
  });
});

describe('privacy-conscious analytics', () => {
  const ctx = { consent: true, session: 's', synthetic: false, now: Date.parse('2026-11-26T00:00:00Z') };

  it('records nothing without consent', () => {
    expect(envelope({ name: 'app_open' }, { ...ctx, consent: false })).toBeNull();
    expect(enqueue([], null)).toEqual([]);
  });

  it('never includes imported comic identifiers; buckets page counts; caps durations', () => {
    expect(sanitize({ name: 'reading_session', publicationId: 'local:abc', seconds: 99999, mode: 'pages' })).toEqual({ seconds: 14400, mode: 'pages' });
    expect(sanitize({ name: 'chapter_start', publicationId: 'flame-sigil-1', mode: 'sigil' })).toEqual({ publicationId: 'flame-sigil-1', mode: 'sigil' });
    expect(sanitize({ name: 'import_complete', format: 'cbz', pages: 37 })).toEqual({ format: 'cbz', pageBucket: '21-60' });
    expect([1, 20, 21, 61, 201].map(pageBucket)).toEqual(['1-20', '1-20', '21-60', '61-200', '200+']);
  });

  it('marks synthetic events and keeps the queue bounded', () => {
    const e = envelope({ name: 'purchase_complete', publicationId: 'flame-sigil-2', tier: 'standard' }, { ...ctx, synthetic: true })!;
    expect(e.synthetic).toBe(true);
    let q: ReturnType<typeof enqueue> = [];
    for (let i = 0; i < 12; i++) q = enqueue(q, e, 10);
    expect(q).toHaveLength(10);
  });
});

describe('achievements', () => {
  it('are earned only from real activity', () => {
    const none = { finishedOriginals: 0, discoveredGlyphs: 0, imported: 0, streak: 0, fragments: 0, collections: 0, bookmarks: 0 };
    expect(earnedAchievements(none)).toEqual([]);
    expect(earnedAchievements({ ...none, discoveredGlyphs: 3, streak: 7, imported: 1 })).toEqual(['first-glyph', 'glyph-hunter', 'first-import', 'streak-7']);
  });
});
