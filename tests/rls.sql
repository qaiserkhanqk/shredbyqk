-- Privacy test for supabase/schema.sql against plain Postgres (run by tests/rls.sh).
-- A minimal stand-in for Supabase: the auth schema, auth.uid() from a setting, and the API roles.
\set ON_ERROR_STOP on
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to authenticated; grant execute on function auth.uid() to authenticated;
\ir ../supabase/schema.sql
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update on public.messages from authenticated; grant update (read_at) on public.messages to authenticated;
grant usage on all sequences in schema public to authenticated;

-- People: coach Q, client A (joins Q), client B (no coach), another coach Z.
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', 'a@x.com'), ('00000000-0000-0000-0000-00000000000b', 'b@x.com'),
 ('00000000-0000-0000-0000-0000000000c1', 'q@x.com'), ('00000000-0000-0000-0000-0000000000c2', 'z@x.com');
update public.profiles set role = 'coach', invite_code = 'QKTEST', name = 'QK' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set role = 'coach', invite_code = 'ZZZZZZ', name = 'Z' where id = '00000000-0000-0000-0000-0000000000c2';

create function pg_temp.as_user(uid text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', uid, false); end $$;
create table pg_temp.results (name text, ok boolean);
create function pg_temp.check(name text, ok boolean) returns void language sql as $$ insert into pg_temp.results values (name, ok) $$;
grant all on pg_temp.results to authenticated;

-- Client A signs in, joins coach Q, logs a set and an app open.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.check('profile auto-created as client', (select role from public.profiles where id = auth.uid()) = 'client');
select public.join_coach('qktest');
insert into public.sessions (client_id, at, ex, reps, good, kg) values (auth.uid(), now(), 'squat', 8, 8, 60);
insert into public.events (client_id) values (auth.uid());
update public.profiles set role = 'coach', invite_code = 'HACK', coach_id = '00000000-0000-0000-0000-0000000000c2' where id = auth.uid();
reset role;
select pg_temp.check('client cannot make themselves a coach or change coach', (select role = 'client' and invite_code is null and coach_id = '00000000-0000-0000-0000-0000000000c1' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'));

-- Client B logs a set; can B see A?
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
insert into public.sessions (client_id, at, ex, reps, good, kg) values (auth.uid(), now(), 'bench', 5, 5, 40);
select pg_temp.check('client sees only their own sets', (select count(*) from public.sessions) = 1);
select pg_temp.check('client cannot see other profiles', (select count(*) from public.profiles) = 1);
do $$ begin insert into public.sessions (client_id, at, ex, reps) values ('00000000-0000-0000-0000-00000000000a', now(), 'fake', 1); perform pg_temp.check('client cannot write as someone else', false);
exception when others then perform pg_temp.check('client cannot write as someone else', true); end $$;
reset role;

-- Coach Q sees A (their client) but not B; sends A a cheer.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select pg_temp.check('coach sees their client', (select count(*) from public.profiles where coach_id = auth.uid()) = 1);
select pg_temp.check('coach sees their client''s sets only', (select count(*) from public.sessions where client_id <> auth.uid()) = 1 and (select ex from public.sessions limit 1) = 'squat');
select pg_temp.check('coach sees their client''s app opens', (select count(*) from public.events) = 1);
insert into public.messages (coach_id, client_id, kind, body) values (auth.uid(), '00000000-0000-0000-0000-00000000000a', 'cheer', 'Great week!');
do $$ begin insert into public.messages (coach_id, client_id, body) values (auth.uid(), '00000000-0000-0000-0000-00000000000b', 'spam'); perform pg_temp.check('coach cannot message someone else''s client', false);
exception when others then perform pg_temp.check('coach cannot message someone else''s client', true); end $$;
do $$ begin update public.sessions set reps = 99; perform pg_temp.check('coach cannot edit client data', (select reps from public.sessions limit 1) <> 99);
exception when others then perform pg_temp.check('coach cannot edit client data', true); end $$;
insert into public.coach_plans (client_id, coach_id, plan, note) values ('00000000-0000-0000-0000-00000000000a', auth.uid(), '{"meals":[]}', 'More protein');
select pg_temp.check('coach saves a plan for their client', (select count(*) from public.coach_plans) = 1);
do $$ begin insert into public.coach_plans (client_id, coach_id, plan) values ('00000000-0000-0000-0000-00000000000b', auth.uid(), '{}'); perform pg_temp.check('coach cannot write a plan for someone else''s client', false);
exception when others then perform pg_temp.check('coach cannot write a plan for someone else''s client', true); end $$;
select pg_temp.check('coach cannot see phones'' push addresses', (select count(*) from public.push_subs) = 0);
reset role;

-- Coach Z sees nothing of Q's client.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
select pg_temp.check('another coach sees none of your clients', (select count(*) from public.sessions) = 0 and (select count(*) from public.profiles where id <> auth.uid()) = 0);
select pg_temp.check('another coach sees none of your plans', (select count(*) from public.coach_plans) = 0);
do $$ begin insert into public.coach_plans (client_id, coach_id, plan) values ('00000000-0000-0000-0000-00000000000a', auth.uid(), '{}'); perform pg_temp.check('another coach cannot write your client''s plan', false);
exception when others then perform pg_temp.check('another coach cannot write your client''s plan', true); end $$;
reset role;

-- Client A reads the cheer and marks it read, but cannot rewrite it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.check('client receives the coach''s cheer', (select body from public.messages) = 'Great week!');
update public.messages set read_at = now();
select pg_temp.check('client reads the plan QK wrote', (select note from public.coach_plans) = 'More protein');
update public.coach_plans set note = 'hacked';
select pg_temp.check('client cannot change QK''s plan', (select note from public.coach_plans) = 'More protein');
insert into public.push_subs (endpoint, client_id, p256dh, auth) values ('https://push.example/1', auth.uid(), 'k', 'a');
select pg_temp.check('client saves their phone''s push address', (select count(*) from public.push_subs) = 1);
do $$ begin insert into public.push_subs (endpoint, client_id, p256dh, auth) values ('https://push.example/2', '00000000-0000-0000-0000-00000000000b', 'k', 'a'); perform pg_temp.check('client cannot save a push address for someone else', false);
exception when others then perform pg_temp.check('client cannot save a push address for someone else', true); end $$;
do $$ begin update public.messages set body = 'edited'; perform pg_temp.check('client cannot rewrite a message', false);
exception when others then perform pg_temp.check('client cannot rewrite a message', true); end $$;
reset role;
select pg_temp.check('message marked read', (select read_at is not null from public.messages));

-- Switching coach: the old coach's plan goes, and the new coach can write one.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.check('client switches to coach Z', public.join_coach('zzzzzz') = 'Z');
reset role;
select pg_temp.check('old coach''s plan removed on switch', (select count(*) from public.coach_plans where client_id = '00000000-0000-0000-0000-00000000000a') = 0);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
insert into public.coach_plans (client_id, coach_id, plan, note) values ('00000000-0000-0000-0000-00000000000a', auth.uid(), '{"meals":[]}', 'from Z');
select pg_temp.check('new coach can save a plan', (select note from public.coach_plans) = 'from Z');
reset role;

-- Invite codes can't be brute-forced: wrong codes return null and the 11th wrong try in an hour is refused.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.check('wrong code → no match (null), no coach attached', public.join_coach('QK0000') is null and (select coach_id from public.profiles where id = auth.uid()) is null);
do $$ begin for i in 1..9 loop perform public.join_coach('QK' || i); end loop; end $$;
do $$ begin perform public.join_coach('qktest'); perform pg_temp.check('11th try in an hour is refused, even with the right code', false);
exception when others then perform pg_temp.check('11th try in an hour is refused, even with the right code', sqlerrm like 'Too many tries%'); end $$;
select pg_temp.check('client can''t read or clear the attempt log', (select count(*) from public.join_attempts) = 0);
reset role;
select pg_temp.check('anonymous visitors see nothing', not has_table_privilege('anon', 'public.sessions', 'select'));

select (case when ok then 'ok   ' else 'FAIL ' end) || name from pg_temp.results;
select case when bool_and(ok) then 'rls: all pass' else 'rls: FAILED' end from pg_temp.results;
