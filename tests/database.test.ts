import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration runs in PostgreSQL and isolates two users with RLS", async () => {
  const db = new PGlite();
  const alice="11111111-1111-4111-8111-111111111111", bob="22222222-2222-4222-8222-222222222222";
  try {
    // Emulate only Supabase's Auth schema and JWT subject; policies below are the real migration.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    const migration=await readFile("supabase/migrations/001_initial_schema.sql","utf8");
    await db.exec(migration);
    await db.exec(migration); // Repeatable setup does not remove users or policies.
    await db.query("insert into auth.users values ($1,$2),($3,$4)",[alice,JSON.stringify({full_name:"Alice",preferred_language:"hi"}),bob,JSON.stringify({full_name:"Bob"})]);
    const profiles=await db.query<{id:string;preferred_language:string}>("select id,preferred_language from public.profiles order by id");
    assert.equal(profiles.rows.length,2); assert.equal(profiles.rows[0].preferred_language,"hi");
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';`);
    assert.equal((await db.query("select * from public.profiles")).rows.length,1);
    await db.query("update public.profiles set full_name='Updated Alice' where id=$1",[alice]);
    const other=await db.query("update public.profiles set full_name='Hijacked' where id=$1 returning id",[bob]);
    assert.equal(other.rows.length,0);
    await assert.rejects(()=>db.query("update public.profiles set latitude=28.6 where id=$1",[alice]));
    await db.query("insert into public.saved_locations(user_id,name,latitude,longitude) values ($1,'Delhi',28.6,77.2)",[alice]);
    await assert.rejects(()=>db.query("insert into public.saved_locations(user_id,name,latitude,longitude) values ($1,'Injected',28.6,77.2)",[bob]));
    await db.exec(`set request.jwt.claim.sub='${bob}';`);
    assert.equal((await db.query("select * from public.saved_locations")).rows.length,0);
    assert.equal((await db.query("delete from public.saved_locations returning id")).rows.length,0);
    assert.equal((await db.query("select * from public.notification_preferences")).rows.length,1);
    await assert.rejects(()=>db.query("insert into public.chat_history(user_id,role,content,consent_given) values ($1,'user','hello',false)",[bob]));
    await db.exec("reset role; set role anon;");
    await assert.rejects(()=>db.query("select * from public.saved_locations"));
    await db.exec("reset role;");
    assert.equal((await db.query<{full_name:string}>("select full_name from public.profiles where id=$1",[bob])).rows[0].full_name,"Bob");
    await db.query("delete from auth.users where id=$1",[alice]);
    assert.equal((await db.query("select * from public.saved_locations")).rows.length,0);
  } finally { await db.close(); }
});
