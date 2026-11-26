import type { AccessPolicy, Availability, Edition } from '@/domain/commerce/types';
import { shouldReplace, validateManifest, type ManifestPublication, type PublicationManifest } from '@/domain/manifest';
import { verifyManifestSignature, type SignatureStatus } from '@/domain/signature';
import type { Chapter, LedgerRecord, Page, Series } from '@/domain/types';

import { codex, cypher, fragments } from './lore';
import flameSigil from './manifests/flame-sigil.json';
import { ALLOW_DEVELOPMENT_KEYS, TRUSTED_ISSUERS } from './trust';

/**
 * Runtime catalog. Every original publication comes from a validated, signed
 * manifest: the bundled ones at startup, and newer ones from the content
 * service when it is configured. Screens read through the getters below and
 * re-render on `subscribeCatalog`.
 */

export { codex, cypher, fragments };

type Installed = { manifest: PublicationManifest; signature: SignatureStatus; source: 'bundled' | 'remote' };

const installed = new Map<string, Installed>();
let version = 0;
const listeners = new Set<() => void>();

/** Series announced by the publisher with no publications yet. */
const upcoming: Series[] = [
  {
    id: 'echo-state',
    publisherId: 'talonsight',
    title: 'Echo State',
    tagline: 'The Echoverse expands.',
    direction: 'ltr',
    defaultMode: 'scroll',
    capabilities: ['standard'],
    chapterIds: [],
    status: 'coming-soon',
    releaseLabel: 'Coming soon',
  },
  {
    id: 'flame-sigil-origin',
    publisherId: 'talonsight',
    title: 'Flame Sigil: Origin',
    tagline: 'The prequel. Opens when all nine fragments are found.',
    direction: 'ltr',
    defaultMode: 'sigil',
    capabilities: ['standard'],
    chapterIds: [],
    status: 'coming-soon',
    releaseLabel: 'Unlocks at 9/9',
  },
];

export type InstallResult = { ok: true } | { ok: false; reason: 'invalid' | 'untrusted' | 'older'; detail?: string[] };

/** Validate, verify and install a manifest. Rejects anything not trusted. */
export function installManifest(raw: unknown, source: Installed['source']): InstallResult {
  const v = validateManifest(raw);
  if (!v.ok) return { ok: false, reason: 'invalid', detail: v.errors };
  const signature = verifyManifestSignature(v.manifest, TRUSTED_ISSUERS, ALLOW_DEVELOPMENT_KEYS);
  // Bundled manifests ship inside the signed app binary, so a development key
  // is acceptable there; remote manifests must carry a trusted signature.
  const acceptable = signature.status === 'trusted' || (source === 'bundled' && signature.status === 'development-key');
  if (!acceptable) return { ok: false, reason: 'untrusted', detail: [signature.status] };
  const current = installed.get(v.manifest.series.id);
  if (current && !shouldReplace(current.manifest, v.manifest)) return { ok: false, reason: 'older' };
  installed.set(v.manifest.series.id, { manifest: v.manifest, signature, source });
  version++;
  listeners.forEach((l) => l());
  return { ok: true };
}

const boot = installManifest(flameSigil, 'bundled');
if (!boot.ok) throw new Error(`Bundled Flame Sigil manifest rejected: ${boot.reason} ${boot.detail?.join('; ') ?? ''}`);

export function subscribeCatalog(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const catalogVersion = () => version;

// ── Adapters ────────────────────────────────────────────────────────────────

const pageFrom = (p: ManifestPublication['pages'][number]): Page => ({
  id: p.id,
  src: p.asset && !p.asset.startsWith('bundled:') ? p.asset : undefined,
  label: p.label,
  width: p.width,
  height: p.height,
  panels: p.panels,
  glyphs: p.glyphs,
});

const chapterFrom = (seriesId: string, p: ManifestPublication): Chapter => ({
  id: p.publicationId,
  seriesId,
  number: p.chapterNumber,
  label: p.label,
  title: p.title,
  description: p.description,
  contentStatus: p.contentStatus,
  pages: p.pages.map(pageFrom),
  credits: p.credits,
});

const all = () => [...installed.values()];
const pubs = () => all().flatMap((i) => i.manifest.publications.map((p) => ({ seriesId: i.manifest.series.id, p })));

// ── Lookups ─────────────────────────────────────────────────────────────────

export function allSeries(): Series[] {
  const fromManifests = all().map(({ manifest: m }) => ({
    id: m.series.id,
    publisherId: m.publisher.id,
    title: m.series.title,
    tagline: m.series.tagline,
    direction: m.series.direction,
    defaultMode: m.series.defaultMode,
    capabilities: m.series.capabilities,
    chapterIds: [...m.publications].sort((a, b) => a.chapterNumber - b.chapterNumber).map((p) => p.publicationId),
    status: m.series.status,
    releaseLabel: m.series.releaseLabel,
  }));
  return [...fromManifests, ...upcoming.filter((u) => !fromManifests.some((s) => s.id === u.id))];
}

export const getSeries = (id: string) => allSeries().find((s) => s.id === id);

export function allChapters(): Chapter[] {
  return pubs().map(({ seriesId, p }) => chapterFrom(seriesId, p));
}

export function getChapter(id: string): Chapter | undefined {
  const hit = pubs().find(({ p }) => p.publicationId === id);
  return hit && chapterFrom(hit.seriesId, hit.p);
}

export const chaptersOf = (seriesId: string) =>
  pubs()
    .filter((x) => x.seriesId === seriesId)
    .map(({ p }) => chapterFrom(seriesId, p))
    .sort((a, b) => a.number - b.number);

export function publicationOf(chapterId: string): ManifestPublication | undefined {
  return pubs().find(({ p }) => p.publicationId === chapterId)?.p;
}

export function availabilityFor(chapterId: string): Availability | undefined {
  const p = publicationOf(chapterId);
  return p && { chapterId, status: p.availability.status, releaseAt: p.availability.releaseAt };
}

export function policyFor(chapterId: string): AccessPolicy | undefined {
  const p = publicationOf(chapterId);
  return p && { chapterId, ...p.access };
}

export function editionsFor(chapterId: string): Edition[] {
  return (publicationOf(chapterId)?.editions ?? []).map((e) => ({ ...e, chapterId }));
}

export const allEditions = (): Edition[] => pubs().flatMap(({ p }) => editionsFor(p.publicationId));

/** POW record for a chapter, derived from its manifest. */
export function ledgerFor(chapterId: string): LedgerRecord | undefined {
  const p = publicationOf(chapterId);
  if (!p || !p.integrity.publicationHash) return undefined;
  return {
    chapterId,
    pageHashes: p.pages.map((pg) => pg.sha256),
    pageBytes: p.pages.map((pg) => pg.bytes),
    chapterHash: p.integrity.publicationHash,
  };
}

/** Issuer and manifest metadata for a series, for verification screens. */
export function provenanceOf(seriesId: string) {
  const i = installed.get(seriesId);
  return i && { manifestId: i.manifest.manifestId, version: i.manifest.version, issuedAt: i.manifest.issuedAt, publisher: i.manifest.publisher, signature: i.signature, source: i.source };
}

export const getEntry = (id: string) => codex.find((e) => e.id === id);
export const panelKey = (page: Page, panelIndex: number) => `${page.id}:${page.panels[panelIndex]?.id ?? panelIndex}`;
export const commentsFor = (key: string) => cypher.filter((c) => c.panelKey === key);
export const commentCount = (key: string) => commentsFor(key).reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);
