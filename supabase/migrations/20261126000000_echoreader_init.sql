-- EchoReader v0.2 backend schema (Supabase / Postgres).
--
-- Separation of concerns (one table family each): profiles, publication
-- catalog, reading progress, purchases, entitlements, reward events,
-- collectibles, community. Clients can read only their own rows; anything
-- that grants value (entitlements, purchases, collectibles, rewards) is
-- written only by the service role (edge functions after store-receipt
-- verification) or by narrowly scoped security-definer functions.
--
-- Not stored anywhere: imported comic files, their titles, or their progress.

-- ── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  analytics_consent boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── Catalog (public, mirrors signed manifests) ──────────────────────────────
create table public.publishers (
  id text primary key,
  name text not null
);
create table public.publications (
  id text primary key,
  series_id text not null,
  publisher_id text not null references public.publishers (id),
  chapter_number int not null check (chapter_number >= 0),
  title text not null,
  status text not null check (status in ('draft', 'scheduled', 'published', 'archived', 'unavailable')),
  release_at timestamptz,
  access_base text not null check (access_base in ('free', 'paid')),
  preview_pages int not null default 0 check (preview_pages >= 0),
  page_count int not null default 0 check (page_count >= 0),
  manifest_version int not null check (manifest_version >= 1),
  publication_hash text check (publication_hash ~ '^[0-9a-f]{64}$'),
  unique (series_id, chapter_number)
);
create table public.editions (
  id text primary key,
  publication_id text not null references public.publications (id) on delete cascade,
  tier text not null check (tier in ('standard', 'collector', 'legendary')),
  price_minor int not null check (price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  supply int check (supply is null or supply > 0),
  collectible boolean not null default false,
  on_sale boolean not null default true
);
create table public.promotions (
  id text primary key,
  publication_id text not null references public.publications (id) on delete cascade,
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);
alter table public.publishers enable row level security;
alter table public.publications enable row level security;
alter table public.editions enable row level security;
alter table public.promotions enable row level security;
create policy publishers_read on public.publishers for select to anon, authenticated using (true);
-- Drafts are not visible to readers at all.
create policy publications_read on public.publications for select to anon, authenticated using (status <> 'draft');
create policy editions_read on public.editions for select to anon, authenticated
  using (exists (select 1 from public.publications p where p.id = publication_id and p.status <> 'draft'));
create policy promotions_read on public.promotions for select to anon, authenticated using (true);

-- ── Reading progress (own rows; never imported comics) ──────────────────────
create table public.reading_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_key text not null check (series_key !~ '^local:'),
  furthest jsonb not null,
  current jsonb,
  current_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, series_key)
);
alter table public.reading_progress enable row level security;
create policy progress_all_own on public.reading_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Purchases and entitlements (service-written) ────────────────────────────
create table public.purchase_transactions (
  id text primary key,                         -- store transaction id: the idempotency key
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  edition_id text not null references public.editions (id),
  status text not null check (status in ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  amount_minor int not null,
  currency text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.entitlements (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  publication_id text not null references public.publications (id),
  edition_id text references public.editions (id),
  source text not null check (source in ('purchase', 'subscription', 'promotion', 'reward', 'grant')),
  status text not null check (status in ('active', 'refunded', 'revoked', 'expired')),
  verification text not null check (verification in ('store-verified', 'server-verified', 'sandbox')),
  transaction_id text references public.purchase_transactions (id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
create index entitlements_user on public.entitlements (user_id, publication_id);
alter table public.purchase_transactions enable row level security;
alter table public.entitlements enable row level security;
create policy tx_select_own on public.purchase_transactions for select to authenticated using (user_id = auth.uid());
create policy ent_select_own on public.entitlements for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: only the service role (bypasses RLS) writes these.

-- ── Collectibles (separate from reading rights) ─────────────────────────────
create table public.collectibles (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  edition_id text not null references public.editions (id),
  transaction_id text references public.purchase_transactions (id),
  serial int check (serial is null or serial > 0),
  status text not null check (status in ('reserved', 'minted-unverified', 'verified')),
  environment text not null check (environment in ('sandbox', 'production')),
  chain jsonb,
  unique (edition_id, serial),
  -- NULL-safe: a CHECK that evaluates to NULL passes, so a missing chain must yield false.
  check (status <> 'verified' or coalesce(chain ? 'contract' and chain ? 'tokenId' and chain ? 'txHash' and chain ? 'verifiedAt', false))
);
alter table public.collectibles enable row level security;
create policy col_select_own on public.collectibles for select to authenticated using (user_id = auth.uid());

-- Allocate the next serial for a numbered edition, respecting supply. Service role only.
create function public.allocate_serial(p_collectible text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_edition text;
  v_supply int;
  v_next int;
begin
  select c.edition_id, e.supply into v_edition, v_supply
    from collectibles c join editions e on e.id = c.edition_id
    where c.id = p_collectible for update of c;
  if v_edition is null then raise exception 'unknown collectible'; end if;
  perform pg_advisory_xact_lock(hashtext(v_edition));
  select coalesce(max(serial), 0) + 1 into v_next from collectibles where edition_id = v_edition;
  if v_supply is not null and v_next > v_supply then raise exception 'sold out'; end if;
  update collectibles set serial = v_next where id = p_collectible and serial is null;
  return v_next;
end $$;
revoke all on function public.allocate_serial(text) from public, anon, authenticated;

-- ── Embers (append-only, idempotent, non-transferable) ──────────────────────
create table public.reward_rules (
  id text primary key,
  trigger text not null,
  amount int not null check (amount >= 0),
  once_per_key boolean not null default true,
  max_per_iso_week int,
  max_per_day int,
  enabled boolean not null default true
);
create table public.reward_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,                              -- `${rule_id}:${key}`: the idempotency key
  rule_id text not null references public.reward_rules (id),
  key text not null,
  amount int not null check (amount >= 0),
  at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.reward_rules enable row level security;
alter table public.reward_events enable row level security;
create policy rules_read on public.reward_rules for select to anon, authenticated using (true);
create policy rewards_select_own on public.reward_events for select to authenticated using (user_id = auth.uid());

-- The only way a reader earns Embers: amount comes from the rule, never the client;
-- duplicates and caps are enforced here.
create function public.award_reward(p_rule text, p_key text) returns int
language plpgsql security definer set search_path = public as $$
declare
  r reward_rules;
  v_uid uuid := auth.uid();
  v_id text;
  v_rows int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into r from reward_rules where id = p_rule;
  if r.id is null or not r.enabled then return 0; end if;
  if char_length(p_key) > 120 then raise exception 'key too long'; end if;
  v_id := p_rule || ':' || p_key;
  if r.max_per_iso_week is not null and (select count(*) from reward_events
      where user_id = v_uid and rule_id = p_rule and date_trunc('week', at) = date_trunc('week', now())) >= r.max_per_iso_week then
    return 0;
  end if;
  if r.max_per_day is not null and (select count(*) from reward_events
      where user_id = v_uid and rule_id = p_rule and at::date = now()::date) >= r.max_per_day then
    return 0;
  end if;
  insert into reward_events (user_id, id, rule_id, key, amount) values (v_uid, v_id, p_rule, p_key, r.amount)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then r.amount else 0 end;
end $$;
revoke all on function public.award_reward(text, text) from public, anon;
grant execute on function public.award_reward(text, text) to authenticated;

-- ── Community (posting disabled until moderation exists) ────────────────────
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  panel_key text not null,
  body text not null check (char_length(body) between 1 and 1000),
  spoils_at jsonb,
  status text not null default 'pending' check (status in ('pending', 'visible', 'removed')),
  created_at timestamptz not null default now()
);
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);
alter table public.community_posts enable row level security;
alter table public.community_reports enable row level security;
create policy posts_read_visible on public.community_posts for select to anon, authenticated using (status = 'visible');
-- Deliberately no insert policy for posts or reports: public posting stays off
-- until moderation tooling ships. Enabling it is a reviewed migration.

-- ── Grants (RLS still applies) ──────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.reading_progress to authenticated;
