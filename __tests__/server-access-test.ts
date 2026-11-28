import { canReadFully, PRODUCTION_TRUST, readablePageCount, resolveAccess, SANDBOX_TRUST } from '@/domain/commerce/access';
import { authorizePages, type ServerPublication } from '../supabase/functions/_shared/authorize';

/**
 * The edge function's page authorization must agree with the app's access
 * resolver in every case, in production and sandbox trust modes. (The
 * database security rules are tested in scripts/test-db.mjs against Postgres.)
 */
describe('server authorization matches the app', () => {
  const pub = (over: Partial<ServerPublication>): ServerPublication => ({ id: 'c', status: 'published', releaseAt: null, accessBase: 'paid', previewPages: 3, pageCount: 20, ...over });
  const now = Date.parse('2026-12-01T12:00:00Z');

  const cases: { name: string; p: ServerPublication; ent?: 'store' | 'sandbox'; promo?: boolean }[] = [
    { name: 'free', p: pub({ accessBase: 'free' }) },
    { name: 'paid with preview', p: pub({}) },
    { name: 'paid without preview', p: pub({ previewPages: 0 }) },
    { name: 'purchased', p: pub({}), ent: 'store' },
    { name: 'sandbox purchase', p: pub({}), ent: 'sandbox' },
    { name: 'promotion', p: pub({ previewPages: 0 }), promo: true },
    { name: 'draft', p: pub({ status: 'draft' }), ent: 'store' },
    { name: 'scheduled future', p: pub({ status: 'scheduled', releaseAt: '2026-12-02T00:00:00Z' }) },
    { name: 'scheduled past', p: pub({ status: 'scheduled', releaseAt: '2026-11-30T00:00:00Z' }) },
    { name: 'archived, owned', p: pub({ status: 'archived' }), ent: 'store' },
    { name: 'archived, not owned', p: pub({ status: 'archived', accessBase: 'free' }) },
  ];

  for (const production of [true, false]) {
    for (const c of cases) {
      it(`${c.name} (${production ? 'production' : 'sandbox'})`, () => {
        const server = authorizePages({
          publication: c.p,
          entitlements: c.ent ? [{ publicationId: 'c', source: 'purchase', status: 'active', verification: c.ent === 'store' ? 'store-verified' : 'sandbox', expiresAt: null }] : [],
          promotions: c.promo ? [{ publicationId: 'c', startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-02T00:00:00Z' }] : [],
          now,
          acceptSandbox: !production,
        });
        const app = resolveAccess({
          availability: { chapterId: 'c', status: c.p.status, releaseAt: c.p.releaseAt ?? undefined },
          policy: {
            chapterId: 'c',
            base: c.p.accessBase,
            previewPages: c.p.previewPages,
            subscriptionEligible: false,
            promotions: c.promo ? [{ id: 'p', kind: 'free', label: 'Promo', startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-02T00:00:00Z' }] : [],
          },
          editions: [],
          entitlements: c.ent
            ? [{ id: 'e', chapterId: 'c', source: 'purchase', status: 'active', grantedAt: '', verification: c.ent === 'store' ? 'store-verified' : 'sandbox' }]
            : [],
          now,
          trusted: production ? PRODUCTION_TRUST : SANDBOX_TRUST,
        });
        const appPages = readablePageCount(app, c.p.pageCount);
        expect(server.pages.length).toBe(appPages);
        expect(server.allowed === 'all').toBe(canReadFully(app) && appPages > 0);
      });
    }
  }
});
