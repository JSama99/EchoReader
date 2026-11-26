import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chapters, codex, cypher, fragments, ledgerFor, series } from '@/content/catalog';
import editions from '@/content/editions.json';
import { earlyWindowIsFair } from '@/domain/access';
import { comparePositions } from '@/domain/position';
import { computeChapterHash, verifyChapter } from '@/domain/pow';

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const root = join(__dirname, '..');

/**
 * Catalog integrity. These tests are the content team's guardrail: bad
 * geometry, unfair schedules or a stale ledger fail CI before they ship.
 */
describe('catalog integrity', () => {
  it('every rect is inside its page', () => {
    for (const ch of chapters)
      for (const page of ch.pages)
        for (const r of [...page.panels.map((p) => p.rect), ...page.glyphs.map((g) => g.rect)]) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(1.0001);
          expect(r.y + r.h).toBeLessThanOrEqual(1.0001);
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
        }
  });

  it('every glyph points at a Codex entry and a real panel', () => {
    const ids = new Set(codex.map((e) => e.id));
    for (const ch of chapters)
      for (const page of ch.pages)
        for (const g of page.glyphs) {
          expect(ids.has(g.codexEntryId)).toBe(true);
          expect(g.panel).toBeLessThan(page.panels.length);
        }
  });

  it('no Codex entry reveals a line before the entry itself is discovered', () => {
    for (const e of codex)
      for (const l of e.lines) expect(comparePositions(l.revealAt, e.firstSeen)).toBeGreaterThanOrEqual(0);
  });

  it('bonds reference existing entries', () => {
    const ids = new Set(codex.map((e) => e.id));
    for (const e of codex) for (const b of e.bondIds ?? []) expect(ids.has(b)).toBe(true);
  });

  it('fragments are unique and ordinals are 1..9', () => {
    const ords = fragments.map((f) => f.ordinal);
    expect(new Set(ords).size).toBe(ords.length);
    for (const o of ords) expect(o >= 1 && o <= 9).toBe(true);
  });

  it('every early-access window is 24h or less', () => {
    for (const ch of chapters) expect(earlyWindowIsFair(ch)).toBe(true);
  });

  it('series reference real chapters in order', () => {
    for (const s of series)
      s.chapterIds.forEach((id, i) => {
        const ch = chapters.find((c) => c.id === id);
        expect(ch?.seriesId).toBe(s.id);
        expect(ch?.number).toBe(i + 1);
      });
  });

  it('cypher comments point at real panels', () => {
    const keys = new Set(chapters.flatMap((c) => c.pages.flatMap((p) => p.panels.map((pn) => `${p.id}:${pn.id}`))));
    for (const c of cypher) expect(keys.has(c.panelKey)).toBe(true);
  });
});

describe('POW ledger for bundled editions', () => {
  it('editions.json page order matches catalog page order', () => {
    for (const ed of editions.chapters) {
      const ch = chapters.find((c) => c.id === ed.chapterId)!;
      expect(ed.pages).toHaveLength(ch.pages.length);
      expect(ch.credits).toEqual(ed.credits);
    }
  });

  it('the app hash implementation reproduces every ledger chapterHash', async () => {
    for (const ed of editions.chapters) {
      const rec = ledgerFor(ed.chapterId)!;
      const recomputed = await computeChapterHash(sha256, {
        seriesId: ed.seriesId,
        chapterId: ed.chapterId,
        credits: ed.credits,
        pageHashes: rec.pageHashes,
      });
      expect(recomputed).toBe(rec.chapterHash);
    }
  });

  it('the bundled page bytes verify against the ledger', async () => {
    for (const ed of editions.chapters) {
      const local = ed.pages.map((p) => createHash('sha256').update(readFileSync(join(root, p))).digest('hex'));
      const result = await verifyChapter(sha256, {
        seriesId: ed.seriesId,
        chapterId: ed.chapterId,
        credits: ed.credits,
        localPageHashes: local,
        record: ledgerFor(ed.chapterId),
      });
      expect(result.status).toBe('verified');
    }
  });
});
