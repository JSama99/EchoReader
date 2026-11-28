import type { AccessPolicy, AvailabilityStatus, ChainRef, Edition } from './commerce/types';
import { canonicalJson } from './pow';
import type {
  Capability,
  ContentStatus,
  Credit,
  GlyphHotspot,
  NormRect,
  Panel,
  Position,
  ReadingDirection,
  ReadingMode,
} from './types';

/**
 * Publication manifest, schema "echoreader.manifest/1".
 * The full specification lives in docs/v0.2/06-MANIFEST-SPEC.md.
 *
 * A manifest describes one series and its publications. It carries what the
 * app needs to list, sell, gate and verify a publication. It never contains
 * public URLs for paid or unpublished pages: those are issued per reader by
 * the content service after an entitlement check.
 */

export const MANIFEST_SCHEMA = 'echoreader.manifest/1';

export type ManifestPage = {
  id: string;
  label: string;
  width: number;
  height: number;
  /** SHA-256 of the page file bytes (hex). */
  sha256: string;
  bytes: number;
  /**
   * Where a reader can fetch the file without authorization: a path bundled
   * with the app, or a public URL. Absent for pages that require an entitlement.
   */
  asset?: string;
  panels: Panel[];
  glyphs: GlyphHotspot[];
};

export type ManifestPublication = {
  publicationId: string;
  chapterNumber: number;
  label: string;
  title: string;
  description?: string;
  /** Hide the description from readers who have not reached this position. */
  descriptionSafeAfter?: Position;
  spoilerLevel: 'none' | 'mild' | 'major';
  contentStatus: ContentStatus;
  direction: ReadingDirection;
  capabilities: Capability[];
  availability: { status: AvailabilityStatus; releaseAt?: string; publishedAt?: string };
  access: Omit<AccessPolicy, 'chapterId'>;
  editions: Omit<Edition, 'chapterId'>[];
  /** Bumped whenever page bytes or credits change. */
  contentVersion: number;
  credits: Credit[];
  cover?: { asset?: string; sha256?: string };
  pageCount: number;
  pages: ManifestPage[];
  integrity: {
    algorithm: 'sha256-canonical-v1';
    /** sha256(canonicalJson({ chapterId, credits, pageHashes, seriesId })), null while there are no pages. */
    publicationHash: string | null;
  };
  /** Reserved for future on-chain edition records. Informational only. */
  chainRefs?: ChainRef[];
};

export type PublicationManifest = {
  schema: typeof MANIFEST_SCHEMA;
  manifestId: string;
  /** Monotonic. A client never replaces a manifest with a lower version. */
  version: number;
  issuedAt: string;
  publisher: { id: string; name: string };
  series: {
    id: string;
    title: string;
    tagline: string;
    direction: ReadingDirection;
    defaultMode: ReadingMode;
    capabilities: Capability[];
    status: 'live' | 'coming-soon';
    releaseLabel?: string;
  };
  publications: ManifestPublication[];
  signature?: { alg: 'ed25519'; keyId: string; value: string };
};

// ── Validation ──────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true; manifest: PublicationManifest } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isInt = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;
const isIso = (v: unknown) => isStr(v) && !Number.isNaN(Date.parse(v));
const HEX64 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CAPS: Capability[] = ['standard', 'sigil', 'echo', 'annotations', 'codex', 'fragments', 'cypher', 'soundtrack', 'verification', 'collectibles', 'blockchain'];
const STATUSES: AvailabilityStatus[] = ['draft', 'scheduled', 'published', 'archived', 'unavailable'];

function rectOk(r: unknown): r is NormRect {
  if (!isObj(r)) return false;
  const { x, y, w, h } = r as NormRect;
  return [x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n)) && x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001;
}

/** Strict structural validation. Unknown data never reaches the reader. */
export function validateManifest(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);

  if (!isObj(raw)) return { ok: false, errors: ['manifest: not an object'] };
  const m = raw as Partial<PublicationManifest>;
  if (m.schema !== MANIFEST_SCHEMA) err('schema', `expected ${MANIFEST_SCHEMA}`);
  if (!isStr(m.manifestId)) err('manifestId', 'required');
  if (!isInt(m.version, 1)) err('version', 'positive integer required');
  if (!isIso(m.issuedAt)) err('issuedAt', 'ISO timestamp required');
  if (!isObj(m.publisher) || !isStr(m.publisher.id) || !isStr(m.publisher.name)) err('publisher', 'id and name required');

  const s = m.series;
  if (!isObj(s)) err('series', 'required');
  else {
    if (!isStr(s.id) || !ID.test(s.id)) err('series.id', 'lowercase id required');
    if (!isStr(s.title)) err('series.title', 'required');
    if (s.direction !== 'ltr' && s.direction !== 'rtl') err('series.direction', 'ltr or rtl');
    if (!['sigil', 'scroll', 'pages'].includes(s.defaultMode as string)) err('series.defaultMode', 'invalid');
    if (!Array.isArray(s.capabilities) || !s.capabilities.every((c) => CAPS.includes(c))) err('series.capabilities', 'unknown capability');
    if (s.status !== 'live' && s.status !== 'coming-soon') err('series.status', 'invalid');
  }

  if (!Array.isArray(m.publications)) err('publications', 'array required');
  const ids = new Set<string>();
  const numbers = new Set<number>();
  (m.publications ?? []).forEach((p, i) => {
    const at = `publications[${i}]`;
    if (!isObj(p)) return err(at, 'object required');
    if (!isStr(p.publicationId) || !ID.test(p.publicationId)) err(`${at}.publicationId`, 'lowercase id required');
    else if (ids.has(p.publicationId)) err(`${at}.publicationId`, 'duplicate');
    else ids.add(p.publicationId);
    if (!isInt(p.chapterNumber, 0)) err(`${at}.chapterNumber`, 'integer ≥ 0 required');
    else if (numbers.has(p.chapterNumber)) err(`${at}.chapterNumber`, 'duplicate');
    else numbers.add(p.chapterNumber);
    if (!isStr(p.title)) err(`${at}.title`, 'required');
    if (!isStr(p.label)) err(`${at}.label`, 'required');
    if (!['complete', 'excerpt', 'awaiting-master'].includes(p.contentStatus)) err(`${at}.contentStatus`, 'invalid');
    if (!Array.isArray(p.capabilities) || !p.capabilities.every((c) => CAPS.includes(c))) err(`${at}.capabilities`, 'unknown capability');
    if (!isObj(p.availability) || !STATUSES.includes(p.availability.status)) err(`${at}.availability.status`, 'invalid');
    else if (p.availability.status === 'scheduled' && !isIso(p.availability.releaseAt)) err(`${at}.availability.releaseAt`, 'required when scheduled');
    if (!isInt(p.contentVersion, 1)) err(`${at}.contentVersion`, 'positive integer required');
    if (!isInt(p.pageCount, 0)) err(`${at}.pageCount`, 'integer required');

    const a = p.access;
    if (!isObj(a) || (a.base !== 'free' && a.base !== 'paid')) err(`${at}.access.base`, 'free or paid');
    else {
      if (!isInt(a.previewPages, 0)) err(`${at}.access.previewPages`, 'integer ≥ 0');
      if (!Array.isArray(a.promotions)) err(`${at}.access.promotions`, 'array required');
      else
        a.promotions.forEach((pr, j) => {
          if (!isIso(pr.startsAt) || !isIso(pr.endsAt) || Date.parse(pr.endsAt) <= Date.parse(pr.startsAt)) err(`${at}.access.promotions[${j}]`, 'valid window required');
        });
      if (a.emberUnlockCost != null && !isInt(a.emberUnlockCost, 1)) err(`${at}.access.emberUnlockCost`, 'positive integer');
      if (a.base === 'paid' && (!Array.isArray(p.editions) || !p.editions.some((e) => e.onSale))) err(`${at}.editions`, 'a paid publication needs an edition on sale');
    }

    (p.editions ?? []).forEach((e, j) => {
      const ep = `${at}.editions[${j}]`;
      if (!isStr(e.id) || !ID.test(e.id)) err(`${ep}.id`, 'lowercase id required');
      if (!['standard', 'collector', 'legendary'].includes(e.tier)) err(`${ep}.tier`, 'invalid');
      if (!isObj(e.price) || !isInt(e.price.amountMinor, 0) || !/^[A-Z]{3}$/.test(e.price.currency)) err(`${ep}.price`, 'integer minor units and ISO currency');
      if (e.includesReading !== true) err(`${ep}.includesReading`, 'every edition must include the readable chapter');
      if (e.collectible && e.collectible.supply != null && !isInt(e.collectible.supply, 1)) err(`${ep}.collectible.supply`, 'positive integer or null');
    });

    if (!Array.isArray(p.pages)) err(`${at}.pages`, 'array required');
    const freeToAll = isObj(a) && a.base === 'free';
    const preview = isObj(a) ? (a.previewPages ?? 0) : 0;
    const published = isObj(p.availability) && (p.availability.status === 'published' || p.availability.status === 'scheduled');
    (p.pages ?? []).forEach((pg, k) => {
      const pp = `${at}.pages[${k}]`;
      if (!isStr(pg.id)) err(`${pp}.id`, 'required');
      if (!isInt(pg.width, 1) || !isInt(pg.height, 1)) err(`${pp}`, 'pixel width and height required');
      if (!isStr(pg.sha256) || !HEX64.test(pg.sha256)) err(`${pp}.sha256`, '64 hex chars required');
      if (!isInt(pg.bytes, 1)) err(`${pp}.bytes`, 'required');
      (pg.panels ?? []).forEach((pn, q) => rectOk(pn.rect) || err(`${pp}.panels[${q}]`, 'rect outside page'));
      (pg.glyphs ?? []).forEach((g, q) => {
        if (!rectOk(g.rect)) err(`${pp}.glyphs[${q}]`, 'rect outside page');
        if (!isInt(g.panel, 0) || g.panel >= (pg.panels ?? []).length) err(`${pp}.glyphs[${q}].panel`, 'must reference a panel');
      });
      // The rule that keeps paid and unpublished art out of public bundles.
      if (pg.asset && !published) err(`${pp}.asset`, 'unpublished pages must not have a public asset');
      if (pg.asset && !freeToAll && k >= preview) err(`${pp}.asset`, 'paid pages beyond the preview must not have a public asset');
    });
    if (Array.isArray(p.pages) && isInt(p.pageCount, 0) && p.pages.length > p.pageCount) err(`${at}.pageCount`, 'fewer than listed pages');
    if (p.contentStatus === 'awaiting-master' && (p.pages ?? []).length > 0) err(`${at}.contentStatus`, 'awaiting-master cannot list pages');
    if (!isObj(p.integrity) || p.integrity.algorithm !== 'sha256-canonical-v1') err(`${at}.integrity`, 'algorithm sha256-canonical-v1 required');
    else if ((p.pages ?? []).length > 0 ? !HEX64.test(p.integrity.publicationHash ?? '') : p.integrity.publicationHash !== null) {
      err(`${at}.integrity.publicationHash`, 'hash required when pages exist, null otherwise');
    }
  });

  if (m.signature != null && (!isObj(m.signature) || m.signature.alg !== 'ed25519' || !isStr(m.signature.keyId) || !/^[0-9a-f]{128}$/.test(m.signature.value ?? ''))) {
    err('signature', 'ed25519 signature with keyId and 64-byte hex value');
  }

  return errors.length ? { ok: false, errors } : { ok: true, manifest: raw as PublicationManifest };
}

/** Bytes that are signed: the canonical JSON of the manifest without its signature. */
export function signingPayload(m: PublicationManifest): string {
  const { signature: _, ...unsigned } = m;
  return canonicalJson(unsigned);
}

/** Accept a newer manifest only. Equal versions must be byte-identical. */
export function shouldReplace(current: PublicationManifest | undefined, incoming: PublicationManifest): boolean {
  if (!current) return true;
  if (incoming.series.id !== current.series.id) return false;
  return incoming.version > current.version;
}
