# EchoReader backend (Supabase): foundation, not deployed

| Path | What it is |
|---|---|
| `migrations/20261126000000_echoreader_init.sql` | Schema plus row-level security for profiles, catalog, progress, purchases, entitlements, collectibles, Embers and community |
| `functions/_shared/authorize.ts` | The server-side page authorization decision (pure, tested in Jest) |
| `functions/content-access/` | Edge function that issues signed URLs for entitled pages |

The schema and its security rules are executed against real Postgres (PGlite)
in `__tests__/backend-test.ts`. To deploy you need a Supabase project:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy content-access
```

Still to build before production: store-receipt verification
(App Store Server API, Google Play Developer API) in a `verify-purchase`
function, Sign in with Apple / Google, and a moderation console before
community posting can be enabled.
