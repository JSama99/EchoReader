#!/usr/bin/env node
/**
 * Executes supabase/migrations against real Postgres (PGlite, in-process)
 * with Supabase's roles and auth.uid() emulated, then tries to break every
 * row-level security rule. Run: npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
let db;

async function as(role, uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  const dir = join(root, 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`
    grant usage on schema public to service_role;
    grant all on all tables in schema public to service_role;
    grant execute on function public.allocate_serial(text) to service_role;
    insert into auth.users values ('${A}'), ('${B}');
    insert into publishers values ('talonsight', 'TalonSight Technologies');
    insert into publications values
      ('fs-1', 'flame-sigil', 'talonsight', 1, 'Signal Lost', 'published', null, 'free', 0, 2, 1, null),
      ('fs-2', 'flame-sigil', 'talonsight', 2, 'White Silence', 'published', null, 'paid', 3, 20, 1, null),
      ('fs-3', 'flame-sigil', 'talonsight', 3, 'Loop Season', 'draft', null, 'paid', 3, 0, 1, null);
    insert into editions values
      ('fs2-standard', 'fs-2', 'standard', 499, 'USD', null, false, true),
      ('fs2-legendary', 'fs-2', 'legendary', 1999, 'USD', 2, true, true),
      ('fs3-standard', 'fs-3', 'standard', 499, 'USD', null, false, true);
    insert into reward_rules values ('glyph-discovered', 'glyph-discovered', 1, true, null, 3, true), ('lore-challenge', 'lore-challenge', 2, true, null, null, false);
    insert into purchase_transactions values ('tx-a', '${A}', 'p', 'fs2-legendary', 'completed', 1999, 'USD', 'production', now(), now());
    insert into entitlements values ('ent:tx-a', '${A}', 'fs-2', 'fs2-legendary', 'purchase', 'active', 'store-verified', 'tx-a', now(), null);
    insert into collectibles values ('col:tx-a', '${A}', 'fs2-legendary', 'tx-a', null, 'reserved', 'production', null);
  `);
});

after(async () => db?.close());

describe('row-level security', () => {
  it('readers see only their own entitlements, purchases and collectibles', async () => {
    assert.deepEqual((await as('authenticated', A, 'select id from entitlements')).rows, [{ id: 'ent:tx-a' }]);
    assert.deepEqual((await as('authenticated', B, 'select id from entitlements')).rows, []);
    assert.deepEqual((await as('authenticated', B, 'select id from purchase_transactions')).rows, []);
    assert.deepEqual((await as('authenticated', B, 'select id from collectibles')).rows, []);
    assert.deepEqual((await as('anon', null, 'select id from entitlements')).rows, []);
  });

  it('nobody can grant themselves an entitlement, a purchase or a collectible', async () => {
    await assert.rejects(as('authenticated', B, `insert into entitlements values ('x', '${B}', 'fs-2', null, 'grant', 'active', 'server-verified', null, now(), null)`));
    await assert.rejects(as('authenticated', B, `insert into purchase_transactions values ('tx-b', '${B}', 'p', 'fs2-standard', 'completed', 0, 'USD', 'production', now(), now())`));
    await assert.rejects(as('authenticated', B, `insert into collectibles values ('c', '${B}', 'fs2-legendary', null, 1, 'reserved', 'production', null)`));
    await assert.rejects(as('authenticated', A, `update entitlements set source = 'grant' where id = 'ent:tx-a'`));
    await assert.rejects(as('authenticated', A, `delete from entitlements where id = 'ent:tx-a'`));
  });

  it('drafts are invisible to readers; the public catalog is readable', async () => {
    assert.deepEqual((await as('anon', null, 'select id from publications order by id')).rows, [{ id: 'fs-1' }, { id: 'fs-2' }]);
    assert.deepEqual((await as('anon', null, `select id from editions where publication_id = 'fs-3'`)).rows, []);
    await assert.rejects(as('authenticated', A, `update publications set access_base = 'free' where id = 'fs-2'`));
  });

  it('progress is private and never stores imported comics', async () => {
    await as('authenticated', A, `insert into reading_progress (user_id, series_key, furthest) values ('${A}', 'flame-sigil', '{"chapter":1,"page":0,"panel":0}')`);
    assert.deepEqual((await as('authenticated', B, 'select * from reading_progress')).rows, []);
    await assert.rejects(as('authenticated', B, `insert into reading_progress (user_id, series_key, furthest) values ('${A}', 'x', '{}')`));
    await assert.rejects(as('authenticated', A, `insert into reading_progress (user_id, series_key, furthest) values ('${A}', 'local:abc', '{}')`));
  });

  it('community posting is off at the database level', async () => {
    await assert.rejects(as('authenticated', A, `insert into community_posts (user_id, panel_key, body) values ('${A}', 'fs1-p04:bell', 'hi')`));
  });

  it('deleting an account removes everything it owns', async () => {
    await db.exec(`insert into auth.users values ('00000000-0000-4000-8000-0000000000cc');
      insert into reading_progress (user_id, series_key, furthest) values ('00000000-0000-4000-8000-0000000000cc', 'flame-sigil', '{}');
      delete from auth.users where id = '00000000-0000-4000-8000-0000000000cc';`);
    assert.deepEqual((await db.query(`select count(*)::int as n from reading_progress where user_id = '00000000-0000-4000-8000-0000000000cc'`)).rows, [{ n: 0 }]);
  });
});

describe('Embers on the server', () => {
  it('award only through the rule, once per key, within caps; never directly', async () => {
    const award = (uid, key, rule = 'glyph-discovered') => as('authenticated', uid, 'select award_reward($1, $2) as n', [rule, key]);
    assert.deepEqual((await award(A, 'g1')).rows, [{ n: 1 }]);
    assert.deepEqual((await award(A, 'g1')).rows, [{ n: 0 }]);
    assert.deepEqual((await award(A, 'g2')).rows, [{ n: 1 }]);
    assert.deepEqual((await award(A, 'g3')).rows, [{ n: 1 }]);
    assert.deepEqual((await award(A, 'g4')).rows, [{ n: 0 }], 'daily cap of 3');
    assert.deepEqual((await award(A, 'q', 'lore-challenge')).rows, [{ n: 0 }], 'disabled rule');
    await assert.rejects(as('anon', null, `select award_reward('glyph-discovered', 'g9')`));
    await assert.rejects(as('authenticated', A, `insert into reward_events (user_id, id, rule_id, key, amount) values ('${A}', 'x', 'glyph-discovered', 'x', 1000)`));
    assert.deepEqual((await as('authenticated', A, 'select sum(amount)::int as total from reward_events')).rows, [{ total: 3 }]);
    assert.deepEqual((await as('authenticated', B, 'select count(*)::int as n from reward_events')).rows, [{ n: 0 }]);
  });
});

describe('numbered editions', () => {
  it('allocate serials up to supply, service role only', async () => {
    await assert.rejects(as('authenticated', A, `select allocate_serial('col:tx-a')`));
    assert.deepEqual((await as('service_role', null, `select allocate_serial('col:tx-a') as n`)).rows, [{ n: 1 }]);
    await db.exec(`insert into collectibles values ('col:2', '${B}', 'fs2-legendary', null, null, 'reserved', 'production', null), ('col:3', '${B}', 'fs2-legendary', null, null, 'reserved', 'production', null)`);
    assert.deepEqual((await as('service_role', null, `select allocate_serial('col:2') as n`)).rows, [{ n: 2 }]);
    await assert.rejects(as('service_role', null, `select allocate_serial('col:3')`), /sold out/);
  });

  it('cannot be marked verified without a complete chain record', async () => {
    await assert.rejects(db.exec(`update collectibles set status = 'verified' where id = 'col:tx-a'`));
  });
});
