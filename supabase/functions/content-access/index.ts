// Supabase Edge Function (Deno): issues short-lived signed URLs for the pages
// a signed-in reader is entitled to. Paid page files live in a private
// Storage bucket and are never listed in public manifests.
//
// POST { publicationId } with the reader's Authorization: Bearer <jwt>
// → { allowed, reason, pages: [{ index, url }] }
//
// NOT DEPLOYED: requires a Supabase project (see docs/v0.2/04-DOMAIN-AND-DATA.md).
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { authorizePages } from '../_shared/authorize.ts';

const BUCKET = 'publication-pages';
const URL_TTL_SECONDS = 300;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const auth = req.headers.get('Authorization') ?? '';
  const { publicationId } = await req.json().catch(() => ({}));
  if (typeof publicationId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(publicationId)) return Response.json({ error: 'bad request' }, { status: 400 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: user } = await asUser.auth.getUser();
  if (!user?.user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: pub }, { data: ents }, { data: promos }] = await Promise.all([
    admin.from('publications').select('id,status,release_at,access_base,preview_pages,page_count').eq('id', publicationId).maybeSingle(),
    admin.from('entitlements').select('publication_id,source,status,verification,expires_at').eq('user_id', user.user.id).eq('publication_id', publicationId),
    admin.from('promotions').select('publication_id,starts_at,ends_at').eq('publication_id', publicationId),
  ]);

  const grant = authorizePages({
    publication: pub && {
      id: pub.id,
      status: pub.status,
      releaseAt: pub.release_at,
      accessBase: pub.access_base,
      previewPages: pub.preview_pages,
      pageCount: pub.page_count,
    },
    entitlements: (ents ?? []).map((e) => ({ publicationId: e.publication_id, source: e.source, status: e.status, verification: e.verification, expiresAt: e.expires_at })),
    promotions: (promos ?? []).map((p) => ({ publicationId: p.publication_id, startsAt: p.starts_at, endsAt: p.ends_at })),
    now: Date.now(),
    acceptSandbox: Deno.env.get('ECHOREADER_ENV') !== 'production',
  });

  const pages = await Promise.all(
    grant.pages.map(async (i) => {
      const path = `${publicationId}/${String(i + 1).padStart(4, '0')}.jpg`;
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS);
      return { index: i, url: data?.signedUrl ?? null };
    }),
  );
  return Response.json({ allowed: grant.allowed, reason: grant.reason, pages });
});
