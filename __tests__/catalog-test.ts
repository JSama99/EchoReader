import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  allChapters,
  allSeries,
  chaptersOf,
  codex,
  cypher,
  editionsFor,
  fragments,
  getChapter,
  installManifest,
  ledgerFor,
  policyFor,
  provenanceOf,
} from '@/content/catalog';
import manifestJson from '@/content/manifests/flame-sigil.json';
import source from '../content-src/flame-sigil.json';
import { pageImages } from '@/content/images';
import { TRUSTED_ISSUERS } from '@/content/trust';
import { imageSize } from '@/domain/import/sniff';
import { signingPayload, validateManifest, type PublicationManifest } from '@/domain/manifest';
import { comparePositions } from '@/domain/position';
import { canonicalJson, computeChapterHash, verifyChapter } from '@/domain/pow';
import { verifyManifestSignature, type TrustedIssuer } from '@/domain/signature';

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const root = join(__dirname, '..');
const manifest = manifestJson as unknown as PublicationManifest;
const clone = (): PublicationManifest => JSON.parse(JSON.stringify(manifest));

/**
 * Catalog integrity. These tests are the content team's guardrail: bad
 * geometry, unapproved titles, a stale manifest or an exposed paid page
 * fail CI before they ship.
 */
describe('approved Flame Sigil catalog', () => {
  it('lists exactly the approved publications, in order', () => {
    expect(chaptersOf('flame-sigil').map((c) => `${c.label} — ${c.title}`)).toEqual([
      'Prologue — Prologue',
      'Chapter One — Signal Lost',
      'Chapter Two — White Silence',
      'Chapter Three — Loop Season',
      'Chapter Four — Roots Run Deep',
      'Chapter Five — Cipher Temple',
      'Chapter Six — Smoke and Static',
    ]);
  });

  it('marks what is real: the Prologue is complete, Chapter One is an excerpt, the rest await masters', () => {
    const prologue = getChapter('flame-sigil-0')!;
    expect(prologue.contentStatus).toBe('complete');
    expect(prologue.pages.map((p) => p.id)).toEqual(['fs0-p01', 'fs0-p02', 'fs0-p03', 'fs0-p04', 'fs0-p05', 'fs0-p06']);
    expect(prologue.pages.map((p) => p.panels.length)).toEqual([5, 6, 6, 5, 5, 5]);
    expect(getChapter('flame-sigil-1')!.contentStatus).toBe('excerpt');
    for (const n of [2, 3, 4, 5, 6]) {
      const ch = getChapter(`flame-sigil-${n}`)!;
      expect(ch.contentStatus).toBe('awaiting-master');
      expect(ch.pages).toEqual([]);
    }
  });

  it('Free Explorer: the Prologue and Chapter One are free; later chapters are paid with a preview', () => {
    expect(policyFor('flame-sigil-0')!.base).toBe('free');
    expect(policyFor('flame-sigil-1')!.base).toBe('free');
    for (const n of [2, 3, 4, 5, 6]) {
      expect(policyFor(`flame-sigil-${n}`)).toMatchObject({ base: 'paid', previewPages: 3 });
      expect(policyFor(`flame-sigil-${n}`)!.emberUnlockCost).toBeUndefined();
    }
  });

  it('prices the three editions as configured, each including the readable chapter', () => {
    const eds = editionsFor('flame-sigil-2');
    expect(eds.map((e) => [e.tier, e.price.amountMinor, e.price.currency, e.includesReading, !!e.collectible])).toEqual([
      ['standard', 499, 'USD', true, false],
      ['collector', 999, 'USD', true, true],
      ['legendary', 1999, 'USD', true, true],
    ]);
  });

  it('every rect is inside its page and every glyph points at a Codex entry and a real panel', () => {
    for (const ch of allChapters())
      for (const p of ch.pages) {
        for (const r of [...p.panels.map((x) => x.rect), ...p.glyphs.map((g) => g.rect)]) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(1.0001);
          expect(r.y + r.h).toBeLessThanOrEqual(1.0001);
        }
        for (const g of p.glyphs) {
          expect(codex.some((e) => e.id === g.codexEntryId)).toBe(true);
          expect(g.panel).toBeLessThan(p.panels.length);
        }
      }
  });

  it('no Codex entry reveals a line before the entry itself is discovered; bonds exist', () => {
    for (const e of codex) {
      for (const l of e.lines) expect(comparePositions(l.revealAt, e.firstSeen)).toBeGreaterThanOrEqual(0);
      for (const b of e.bondIds ?? []) expect(codex.some((x) => x.id === b)).toBe(true);
    }
  });

  it('fragments are unique and ordinals are 1..9', () => {
    const ords = fragments.map((f) => f.ordinal);
    expect(new Set(ords).size).toBe(ords.length);
    for (const o of ords) expect(o >= 1 && o <= 9).toBe(true);
  });

  it('series reference real chapters in order; sample cypher comments point at real panels', () => {
    for (const s of allSeries()) for (const id of s.chapterIds) expect(getChapter(id)?.seriesId).toBe(s.id);
    const keys = new Set(allChapters().flatMap((c) => c.pages.flatMap((p) => p.panels.map((pn) => `${p.id}:${pn.id}`))));
    for (const c of cypher) expect(keys.has(c.panelKey)).toBe(true);
  });
});

describe('publication manifest', () => {
  it('validates and is signed by a trusted issuer', () => {
    expect(validateManifest(manifest)).toEqual({ ok: true, manifest });
    const sig = verifyManifestSignature(manifest, TRUSTED_ISSUERS, true);
    expect(sig.status).toBe('trusted');
    expect(provenanceOf('flame-sigil')).toMatchObject({ version: manifest.version, source: 'bundled', signature: { status: 'trusted' } });
  });

  it('a development key is not trusted when development keys are not allowed', () => {
    expect(verifyManifestSignature(manifest, TRUSTED_ISSUERS, false).status).toBe('development-key');
  });

  it('any edit breaks the signature', () => {
    const m = clone();
    m.publications[2].editions[0].price.amountMinor = 1;
    expect(verifyManifestSignature(m, TRUSTED_ISSUERS, true).status).toBe('invalid');
    const n = clone();
    n.publications[1].access.base = 'paid';
    expect(verifyManifestSignature(n, TRUSTED_ISSUERS, true).status).toBe('invalid');
  });

  it('rejects unknown keys, wrong publishers and unsigned manifests', () => {
    const { signature: _, ...unsigned } = clone();
    expect(verifyManifestSignature(unsigned as PublicationManifest, TRUSTED_ISSUERS, true).status).toBe('unsigned');
    const other: TrustedIssuer[] = [{ ...TRUSTED_ISSUERS[0], publisherId: 'someone-else' }];
    expect(verifyManifestSignature(manifest, other, true).status).toBe('publisher-mismatch');
    expect(verifyManifestSignature(manifest, [], true)).toEqual({ status: 'unknown-key', keyId: 'talonsight-dev-1' });
  });

  it('install accepts only newer, valid, trusted manifests', () => {
    expect(installManifest(manifest, 'remote')).toEqual({ ok: false, reason: 'older' });
    const tampered = clone();
    tampered.version = manifest.version + 1;
    expect(installManifest(tampered, 'remote')).toMatchObject({ ok: false, reason: 'untrusted' });
    expect(installManifest({ schema: 'nope' }, 'remote')).toMatchObject({ ok: false, reason: 'invalid' });

    // A newer manifest signed by an untrusted key is refused even if well-formed.
    const { privateKey } = generateKeyPairSync('ed25519');
    const v2 = clone();
    v2.version = manifest.version + 1;
    v2.signature = { alg: 'ed25519', keyId: 'talonsight-dev-1', value: sign(null, Buffer.from(signingPayload(v2)), privateKey).toString('hex') };
    expect(installManifest(v2, 'remote')).toMatchObject({ ok: false, reason: 'untrusted', detail: ['invalid'] });
  });

  it('a newer manifest signed with the trusted key replaces the old one', () => {
    const key = createPrivateKey(readFileSync(join(root, 'scripts/dev-keys/talonsight-dev-1.pem')));
    const v2 = clone();
    v2.version = manifest.version + 1;
    v2.publications[2].availability = { status: 'scheduled', releaseAt: '2027-01-08T14:00:00.000Z' };
    v2.signature = { alg: 'ed25519', keyId: 'talonsight-dev-1', value: sign(null, Buffer.from(signingPayload(v2)), key).toString('hex') };
    // Remote manifests need a production-trusted key; in this (development) test run the dev key is trusted.
    expect(installManifest(v2, 'remote')).toEqual({ ok: true });
    expect(provenanceOf('flame-sigil')?.version).toBe(manifest.version + 1);
    expect(installManifest(manifest, 'remote')).toEqual({ ok: false, reason: 'older' });
  });

  it('never exposes paid or unpublished pages publicly', () => {
    const m = clone();
    const paid = m.publications[2];
    paid.availability = { status: 'published' };
    paid.contentStatus = 'complete';
    paid.pageCount = 5;
    const page = { ...m.publications[1].pages[0] };
    paid.pages = [0, 1, 2, 3, 4].map((i) => ({ ...page, id: `p${i}`, asset: `https://cdn.example/fs2/${i}.jpg` }));
    paid.integrity = { algorithm: 'sha256-canonical-v1', publicationHash: 'a'.repeat(64) };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual([
      'publications[2].pages[3].asset: paid pages beyond the preview must not have a public asset',
      'publications[2].pages[4].asset: paid pages beyond the preview must not have a public asset',
    ]);
    paid.pages = paid.pages.map((p, i) => (i < 3 ? p : { ...p, asset: undefined }));
    expect(validateManifest(m).ok).toBe(true);
    paid.availability = { status: 'draft' };
    expect(validateManifest(m).ok).toBe(false);
  });

  it('reports precise errors for malformed manifests', () => {
    const m = clone() as unknown as Record<string, unknown> & PublicationManifest;
    m.version = 0;
    m.publications[1].pages[0].glyphs[0].panel = 99;
    m.publications[3].editions[0].includesReading = false as true;
    m.publications[4].chapterNumber = 1;
    const r = validateManifest(m);
    expect(!r.ok && r.errors).toEqual([
      'version: positive integer required',
      'publications[1].pages[0].glyphs[0].panel: must reference a panel',
      'publications[3].editions[0].includesReading: every edition must include the readable chapter',
      'publications[4].chapterNumber: duplicate',
    ]);
  });
});

describe('POW integrity for bundled pages', () => {
  const pub = manifest.publications.find((p) => p.publicationId === 'flame-sigil-1')!;
  const filesOf = (id: string) => (source.publications.find((p) => p.publicationId === id)!.pages as { file: string }[]).map((p) => p.file);
  const files = filesOf('flame-sigil-1');

  it('the manifest records the real bytes, sizes and pixel dimensions of every page file', () => {
    for (const p of manifest.publications) {
      const paths = filesOf(p.publicationId);
      expect(paths).toHaveLength(p.pages.length);
      p.pages.forEach((pg, i) => {
        const bytes = readFileSync(join(root, paths[i]));
        expect(pg.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
        expect(pg.bytes).toBe(bytes.length);
        expect(imageSize(new Uint8Array(bytes))).toEqual({ width: pg.width, height: pg.height });
      });
    }
  });

  it('every bundled page has art registered with the app', () => {
    for (const ch of allChapters()) for (const p of ch.pages) expect(pageImages[p.id]).toBeDefined();
  });

  it('the app hash implementation reproduces the publication hash (unchanged since v0.1)', async () => {
    const rec = ledgerFor('flame-sigil-1')!;
    expect(await computeChapterHash(sha256, { seriesId: 'flame-sigil', chapterId: 'flame-sigil-1', credits: pub.credits, pageHashes: rec.pageHashes })).toBe(
      rec.chapterHash,
    );
    expect(rec.chapterHash).toBe('2c8f81b5022d9c68490138a47190eb86a9cba60c415744cf091711bfc4e3ab4a');
  });

  it('the bundled page bytes verify against the manifest record', async () => {
    const local = files.map((f) => createHash('sha256').update(readFileSync(join(root, f))).digest('hex'));
    const result = await verifyChapter(sha256, {
      seriesId: 'flame-sigil',
      chapterId: 'flame-sigil-1',
      credits: getChapter('flame-sigil-1')!.credits,
      localPageHashes: local,
      record: ledgerFor('flame-sigil-1'),
    });
    expect(result.status).toBe('verified');
  });

  it('the build script and the app agree on canonical JSON', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: undefined }] })).toBe('{"a":[{"d":2}],"b":1}');
  });
});
