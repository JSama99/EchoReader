import { createHash } from 'node:crypto';

import { fragmentProgress, newlyFound, toRoman } from '@/domain/fragments';
import { comparePositions, isReached, maxPosition } from '@/domain/position';
import { canonicalJson, computeChapterHash, shortHash, verifyChapter } from '@/domain/pow';
import { resolveMode } from '@/domain/reading-mode';
import { formatCountdown, isoWeekKey } from '@/domain/rewards';
import {
  cameraForRect,
  chapterProgress,
  fitPageWidth,
  hitRect,
  nextStep,
  originCompensation,
  panelAtLine,
  prevStep,
  screenToPage,
  spreadsFor,
  tapZoneAction,
} from '@/domain/sigil';
import {
  activeGlyphs,
  discoveredEntries,
  shieldComments,
  shieldEntry,
} from '@/domain/spoilers';
import type { CodexEntry, Fragment, Page, Series } from '@/domain/types';

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const P = (chapter: number, page: number, panel: number) => ({ chapter, page, panel });

describe('position', () => {
  it('orders by chapter, then page, then panel', () => {
    expect(comparePositions(P(1, 0, 5), P(2, 0, 0))).toBeLessThan(0);
    expect(comparePositions(P(2, 3, 0), P(2, 2, 9))).toBeGreaterThan(0);
    expect(comparePositions(P(2, 3, 4), P(2, 3, 4))).toBe(0);
  });
  it('treats the current panel as reached', () => {
    expect(isReached(P(1, 2, 3), P(1, 2, 3))).toBe(true);
    expect(isReached(P(1, 2, 4), P(1, 2, 3))).toBe(false);
  });
  it('maxPosition never moves backwards', () => {
    expect(maxPosition(P(1, 1, 1), P(1, 0, 9))).toEqual(P(1, 1, 1));
  });
});

describe('spoiler shield', () => {
  const entry: CodexEntry = {
    id: 'malik',
    seriesId: 'flame-sigil',
    kind: 'character',
    name: 'Malik Blaze',
    tags: [],
    firstSeen: P(1, 1, 0),
    lines: [
      { text: 'a', revealAt: P(1, 1, 0) },
      { text: 'b', revealAt: P(1, 1, 2) },
      { text: 'c', revealAt: P(3, 0, 0) },
      { text: 'd', revealAt: P(2, 0, 0) },
    ],
  };

  it('shows only lines at or before the furthest panel', () => {
    const s = shieldEntry(entry, P(1, 1, 2));
    expect(s.visibleLines).toEqual(['a', 'b']);
    expect(s.sealedCount).toBe(2);
    expect(s.nextReveal).toEqual(P(2, 0, 0));
  });

  it('hides entries the reader has not met', () => {
    expect(discoveredEntries([entry], P(1, 0, 9))).toEqual([]);
    expect(discoveredEntries([entry], P(1, 1, 0))).toHaveLength(1);
  });

  it('only activates glyphs on reached panels', () => {
    const glyphs = [
      { id: 'g1', rect: { x: 0, y: 0, w: 0.1, h: 0.1 }, codexEntryId: 'x', panel: 0 },
      { id: 'g2', rect: { x: 0, y: 0, w: 0.1, h: 0.1 }, codexEntryId: 'y', panel: 3 },
    ];
    expect(activeGlyphs(glyphs, 1, 0, P(1, 0, 2)).map((g) => g.id)).toEqual(['g1']);
    expect(activeGlyphs(glyphs, 1, 0, P(2, 0, 0)).map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  it('folds spoiler comments, including nested replies, without removing them', () => {
    const out = shieldComments(
      [
        {
          id: 'c1',
          panelKey: 'k',
          author: 'a',
          isCreator: false,
          body: 'safe',
          createdAt: '',
          votes: 0,
          replies: [
            { id: 'r1', panelKey: 'k', author: 'b', isCreator: false, body: 'later', createdAt: '', votes: 0, spoilsAt: P(2, 0, 0) },
          ],
        },
      ],
      P(1, 5, 0),
    );
    expect(out[0].folded).toBe(false);
    expect(out[0].replies?.[0].folded).toBe(true);
    expect(out[0].replies?.[0].body).toBe('later');
  });
});

describe('fragments', () => {
  const frags: Fragment[] = [
    { id: 'f2', ordinal: 2, title: 'II', seriesId: 's', foundAt: P(3, 0, 0) },
    { id: 'f1', ordinal: 1, title: 'I', seriesId: 's', foundAt: P(1, 1, 3) },
  ];
  it('counts found fragments and points at the next one', () => {
    const p = fragmentProgress(frags, P(1, 1, 3));
    expect(p.count).toBe(1);
    expect(p.next?.id).toBe('f2');
    expect(p.originUnlocked).toBe(false);
  });
  it('reports a fragment exactly once when crossed', () => {
    expect(newlyFound(frags, P(1, 1, 2), P(1, 1, 3)).map((f) => f.id)).toEqual(['f1']);
    expect(newlyFound(frags, P(1, 1, 3), P(1, 1, 4))).toEqual([]);
    expect(newlyFound(frags, P(1, 1, 4), P(1, 0, 0))).toEqual([]);
  });
  it('unlocks Origin at nine', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      id: `f${i}`,
      ordinal: i + 1,
      title: '',
      seriesId: 's',
      foundAt: P(1, 0, i),
    }));
    expect(fragmentProgress(nine, P(1, 0, 8)).originUnlocked).toBe(true);
  });
  it('renders roman numerals 1..9', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(toRoman)).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX',
    ]);
  });
});

describe('time keys', () => {
  it('computes ISO weeks across year boundaries', () => {
    expect(isoWeekKey(Date.parse('2026-11-26T12:00:00Z'))).toBe('2026-W48');
    expect(isoWeekKey(Date.parse('2027-01-01T12:00:00Z'))).toBe('2026-W53');
    expect(isoWeekKey(Date.parse('2021-01-03T12:00:00Z'))).toBe('2020-W53');
  });

  it('formats countdowns, with days when needed', () => {
    expect(formatCountdown(82694_000)).toBe('22:58:14');
    expect(formatCountdown(-5)).toBe('00:00:00');
    expect(formatCountdown(2 * 86400_000 + 61_000)).toBe('2d 00:01:01');
  });
});

describe('POW verification', () => {
  const credits = [{ role: 'Creator', name: 'J-Sama' }];
  const pages = ['aa', 'bb', 'cc'];

  it('canonical JSON sorts keys recursively and ignores undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[2,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('is stable regardless of key insertion order', async () => {
    const h1 = await computeChapterHash(sha256, { seriesId: 's', chapterId: 'c', credits, pageHashes: pages });
    const h2 = await sha256(canonicalJson({ pageHashes: pages, credits, chapterId: 'c', seriesId: 's' }));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies a matching chapter', async () => {
    const chapterHash = await computeChapterHash(sha256, { seriesId: 's', chapterId: 'c', credits, pageHashes: pages });
    const r = await verifyChapter(sha256, {
      seriesId: 's',
      chapterId: 'c',
      credits,
      localPageHashes: pages,
      record: { chapterId: 'c', pageHashes: pages, chapterHash },
    });
    expect(r).toEqual({ status: 'verified', chapterHash });
  });

  it('names the exact pages that differ', async () => {
    const chapterHash = await computeChapterHash(sha256, { seriesId: 's', chapterId: 'c', credits, pageHashes: pages });
    const r = await verifyChapter(sha256, {
      seriesId: 's',
      chapterId: 'c',
      credits,
      localPageHashes: ['aa', 'XX', 'cc', 'dd'],
      record: { chapterId: 'c', pageHashes: pages, chapterHash },
    });
    expect(r.status).toBe('mismatch');
    if (r.status === 'mismatch') expect(r.mismatchedPages).toEqual([1, 3]);
  });

  it('detects tampered credits even when pages match', async () => {
    const chapterHash = await computeChapterHash(sha256, { seriesId: 's', chapterId: 'c', credits, pageHashes: pages });
    const r = await verifyChapter(sha256, {
      seriesId: 's',
      chapterId: 'c',
      credits: [{ role: 'Creator', name: 'Someone else' }],
      localPageHashes: pages,
      record: { chapterId: 'c', pageHashes: pages, chapterHash },
    });
    expect(r.status).toBe('mismatch');
    if (r.status === 'mismatch') expect(r.mismatchedPages).toEqual([]);
  });

  it('reports a missing or mismatched record', async () => {
    const base = { seriesId: 's', chapterId: 'c', credits, localPageHashes: pages };
    expect(await verifyChapter(sha256, { ...base, record: undefined })).toEqual({ status: 'no-record' });
    expect(
      await verifyChapter(sha256, { ...base, record: { chapterId: 'other', pageHashes: pages, chapterHash: 'x' } }),
    ).toEqual({ status: 'no-record' });
  });

  it('shortens hashes for display', () => {
    expect(shortHash('7f3a00000000c91e')).toBe('7f3a…c91e');
    expect(shortHash('abc')).toBe('abc');
  });
});

describe('Sigil View camera', () => {
  const pageSize = { width: 400, height: 600 };
  const viewport = { width: 400, height: 800 };

  it('centers and fits a panel within padding', () => {
    const rect = { x: 0.5, y: 0.5, w: 0.5, h: 0.25 }; // 200x150 px at (200..400, 300..450)
    const cam = cameraForRect(rect, pageSize, viewport, 16);
    expect(cam.scale).toBeCloseTo((400 - 32) / 200);
    const cx = (200 + 100) * cam.scale + cam.translateX;
    const cy = (300 + 75) * cam.scale + cam.translateY;
    expect(cx).toBeCloseTo(200);
    expect(cy).toBeCloseTo(400);
  });

  it('caps magnification for tiny panels', () => {
    const cam = cameraForRect({ x: 0, y: 0, w: 0.01, h: 0.01 }, pageSize, viewport, 16, 4);
    expect(cam.scale).toBe(4);
  });

  it('fits a page to the viewport width preserving aspect', () => {
    expect(fitPageWidth({ width: 1024, height: 1536 }, 390)).toEqual({ width: 390, height: 585 });
  });

  const pages = [
    { panels: [{}, {}] },
    { panels: [{}] },
  ] as unknown as Page[];

  it('steps through panels across pages', () => {
    expect(nextStep(pages, { page: 0, panel: 0 })).toEqual({ page: 0, panel: 1 });
    expect(nextStep(pages, { page: 0, panel: 1 })).toEqual({ page: 1, panel: 0 });
    expect(nextStep(pages, { page: 1, panel: 0 })).toBeNull();
    expect(prevStep(pages, { page: 1, panel: 0 })).toEqual({ page: 0, panel: 1 });
    expect(prevStep(pages, { page: 0, panel: 0 })).toBeNull();
  });

  it('reports progress by panel', () => {
    expect(chapterProgress(pages, { page: 0, panel: 0 })).toBeCloseTo(1 / 3);
    expect(chapterProgress(pages, { page: 1, panel: 0 })).toBe(1);
  });

  it('inverts the advancing edge for right-to-left books', () => {
    expect(tapZoneAction(380, 400, 'ltr')).toBe('next');
    expect(tapZoneAction(20, 400, 'ltr')).toBe('prev');
    expect(tapZoneAction(20, 400, 'rtl')).toBe('next');
    expect(tapZoneAction(380, 400, 'rtl')).toBe('prev');
    expect(tapZoneAction(200, 400, 'rtl')).toBe('menu');
  });
});

describe('reading mode resolution', () => {
  const series = { id: 'x', defaultMode: 'pages' } as Series;
  it('prefers per-series, then global, then authored default', () => {
    expect(resolveMode(series, { x: 'scroll' }, 'sigil')).toBe('scroll');
    expect(resolveMode(series, {}, 'sigil')).toBe('sigil');
    expect(resolveMode(series, {}, undefined)).toBe('pages');
  });
});

describe('Sigil View hit testing', () => {
  const cam = cameraForRect;
  const pageSize = { width: 400, height: 600 };
  const viewport = { width: 400, height: 800 };

  it('inverts the camera exactly', () => {
    const c = cam({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, pageSize, viewport, 16);
    // Center of the viewport must map to the center of the panel.
    const p = screenToPage({ x: 200, y: 400 }, c, pageSize);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(0.5);
  });

  it('hits rects with slop and misses outside', () => {
    const items = [{ id: 'g', rect: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } }];
    expect(hitRect(items, { x: 0.55, y: 0.55 })?.id).toBe('g');
    expect(hitRect(items, { x: 0.61, y: 0.55 })?.id).toBe('g');
    expect(hitRect(items, { x: 0.7, y: 0.55 })).toBeUndefined();
  });

  it('finds the panel a reading line has reached', () => {
    const page = { panels: [{ rect: { y: 0 } }, { rect: { y: 0.4 } }, { rect: { y: 0.4 } }, { rect: { y: 0.8 } }] } as unknown as Page;
    expect(panelAtLine(page, 100, 600)).toBe(0);
    expect(panelAtLine(page, 300, 600)).toBe(2);
    expect(panelAtLine(page, 590, 600)).toBe(3);
  });
});

describe('center-origin transform compensation', () => {
  it('maps the panel center to the viewport center when scaling about the view center', () => {
    const pageSize = { width: 390, height: 585 };
    const viewport = { width: 390, height: 844 };
    const rect = { x: 0.371, y: 0.4023, w: 0.629, h: 0.1888 };
    const cam = cameraForRect(rect, pageSize, viewport, 12);
    const o = originCompensation(cam, pageSize);
    // Center-origin transform: p' = t + c + s(p - c)
    const cx = (rect.x + rect.w / 2) * pageSize.width;
    const cy = (rect.y + rect.h / 2) * pageSize.height;
    const sx = o.x + pageSize.width / 2 + cam.scale * (cx - pageSize.width / 2);
    const sy = o.y + pageSize.height / 2 + cam.scale * (cy - pageSize.height / 2);
    expect(sx).toBeCloseTo(viewport.width / 2);
    expect(sy).toBeCloseTo(viewport.height / 2);
  });
});

describe('spreads', () => {
  it('pairs pages on wide screens and keeps a trailing single', () => {
    expect(spreadsFor(2, true)).toEqual([[0, 1]]);
    expect(spreadsFor(5, true)).toEqual([[0, 1], [2, 3], [4]]);
    expect(spreadsFor(3, false)).toEqual([[0], [1], [2]]);
    expect(spreadsFor(0, true)).toEqual([]);
  });
});
