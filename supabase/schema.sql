-- Shred by QK: coach dashboard database. Paste this whole file into Supabase → SQL Editor → Run, once.
-- Privacy is enforced by the database (row-level security), not by the app:
--   * A client can only read and write their own rows.
--   * A coach can only READ the rows of clients who joined with that coach's invite code.
--   * No video or body landmarks are ever stored: only numbers (sets, reps, weights, form scores, check-ins).

-- People: every signed-in user has one profile row. Coaches have role 'coach' and an invite code.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach')),
  name text,
  invite_code text unique,                 -- coaches only: what clients type to join
  coach_id uuid references public.profiles (id) on delete set null,
  goal text,
  program jsonb,                           -- { id, block, start, blockStart, plan? }
  plan jsonb,                              -- { days: [0..6], time, place }
  weekly_goal int,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

-- Sets: one row per logged set (camera or guided).
create table if not exists public.sessions (
  client_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null,
  ex text not null,
  name text,
  reps int,
  good int,
  kg numeric,
  secs int,
  target int,
  guided boolean default false,
  faults jsonb,
  vl numeric,
  primary key (client_id, at, ex)
);

-- Morning check-ins (readiness).
create table if not exists public.checkins (
  client_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null,
  data jsonb,
  primary key (client_id, at)
);

-- App opens: what "logged in today" is based on.
create table if not exists public.events (
  client_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null default 'open',
  primary key (client_id, at, kind)
);

-- Food: one row per day (totals and what was eaten; no photos), and places a client added.
alter table public.profiles add column if not exists food_week jsonb;  -- QK's weekly food report, summarised
alter table public.profiles add column if not exists care jsonb;       -- sore areas, rough days this week, travel, Ramadan (labels and counts only)
create table if not exists public.food_days (
  client_id uuid not null references public.profiles (id) on delete cascade,
  at date not null,
  kcal int, protein int, carbs int, fat int,
  water int, steps int,
  items jsonb,                             -- [{ meal, name, label, kcal, src }]
  primary key (client_id, at)
);
create table if not exists public.places (
  client_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  items jsonb,                             -- [{ name, dish, opts }], each tied to a dish model
  updated_at timestamptz not null default now(),
  primary key (client_id, name)
);

-- Coach → client messages (cheers and nudges). QK reads them out when the client opens the app.
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'cheer' check (kind in ('cheer', 'nudge', 'note')),
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists sessions_client_at on public.sessions (client_id, at desc);
create index if not exists events_client_at on public.events (client_id, at desc);
create index if not exists messages_client on public.messages (client_id, created_at desc);
create index if not exists profiles_coach on public.profiles (coach_id);

-- Helper: is the signed-in user this client's coach?
create or replace function public.is_my_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = cid and p.coach_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.checkins enable row level security;
alter table public.events enable row level security;
alter table public.messages enable row level security;
alter table public.food_days enable row level security;
alter table public.places enable row level security;

-- Profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- A profile row is created automatically at sign-up (always as a client).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- The app can never change role, invite code or coach: only join_coach() and the SQL editor can.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    new.role := old.role; new.invite_code := old.invite_code; new.coach_id := old.coach_id;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();
drop policy if exists "coach reads clients" on public.profiles;
create policy "coach reads clients" on public.profiles for select using (coach_id = auth.uid());

-- Client data: the client writes and reads their own; their coach can read.
drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions for all using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads sessions" on public.sessions;
create policy "coach reads sessions" on public.sessions for select using (public.is_my_client(client_id));

drop policy if exists "own checkins" on public.checkins;
create policy "own checkins" on public.checkins for all using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads checkins" on public.checkins;
create policy "coach reads checkins" on public.checkins for select using (public.is_my_client(client_id));

drop policy if exists "own events" on public.events;
create policy "own events" on public.events for all using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads events" on public.events;
create policy "coach reads events" on public.events for select using (public.is_my_client(client_id));

-- Food and places: the client owns theirs; their coach can read them.
drop policy if exists "own food" on public.food_days;
create policy "own food" on public.food_days for all using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads food" on public.food_days;
create policy "coach reads food" on public.food_days for select using (public.is_my_client(client_id));
drop policy if exists "own places" on public.places;
create policy "own places" on public.places for all using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads places" on public.places;
create policy "coach reads places" on public.places for select using (public.is_my_client(client_id));

-- Messages: the coach writes to their own clients; the client reads theirs and marks them read.
drop policy if exists "coach sends" on public.messages;
create policy "coach sends" on public.messages for insert with check (coach_id = auth.uid() and public.is_my_client(client_id));
drop policy if exists "coach reads sent" on public.messages;
create policy "coach reads sent" on public.messages for select using (coach_id = auth.uid());
drop policy if exists "client reads own" on public.messages;
create policy "client reads own" on public.messages for select using (client_id = auth.uid());
drop policy if exists "client marks read" on public.messages;
create policy "client marks read" on public.messages for update using (client_id = auth.uid()) with check (client_id = auth.uid());
-- Clients can only set read_at on a message, never change what the coach wrote.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- Notifications that reach a closed app (Web Push). The phone saves its push address here; a daily job
-- (tools/push-checkins.mjs, run by .github/workflows/push.yml) reminds clients whose check-in is due.
alter table public.profiles add column if not exists next_checkin date;   -- set by the client's app
alter table public.profiles add column if not exists diet_plan jsonb;     -- the client's current diet plan
alter table public.profiles add column if not exists notify text;         -- essential | normal | off (the client chooses)
alter table public.profiles add column if not exists last_food date;      -- last day they logged food (for the weekly nudge)
alter table public.profiles add column if not exists scores jsonb;         -- health, nutrition, recovery, activity, workout, fitness age
create table if not exists public.push_subs (
  endpoint text primary key,
  client_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent date,
  last_nudge date
);
alter table public.push_subs add column if not exists last_nudge date;
alter table public.push_subs add column if not exists last_checkin_for date; -- the due date we last reminded about (once per check-in)
alter table public.push_subs enable row level security;
drop policy if exists "own push" on public.push_subs;
create policy "own push" on public.push_subs for all using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Diet plans QK edits: the coach writes, the client reads (and the app shows "Edited by QK").
create table if not exists public.coach_plans (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  plan jsonb not null,
  note text,
  updated_at timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.coach_plans enable row level security;
drop policy if exists "coach writes plans" on public.coach_plans;
create policy "coach writes plans" on public.coach_plans for all using (public.is_my_client(client_id)) with check (coach_id = auth.uid() and public.is_my_client(client_id));
drop policy if exists "client reads own plan" on public.coach_plans;
create policy "client reads own plan" on public.coach_plans for select using (client_id = auth.uid());

-- Joining a coach: a client calls this with the coach's invite code. Returns the coach's name.
-- Wrong guesses are counted (10 an hour per account) so invite codes can't be brute-forced. A wrong code returns
-- null instead of raising: an exception would roll back the attempt we just recorded.
create table if not exists public.join_attempts (uid uuid not null, at timestamptz not null default now());
create index if not exists join_attempts_uid_at on public.join_attempts (uid, at);
alter table public.join_attempts enable row level security;  -- no policies: only join_coach() writes here
create or replace function public.join_coach(code text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.profiles; tries int;
begin
  select count(*) into tries from public.join_attempts where uid = auth.uid() and at > now() - interval '1 hour';
  if tries >= 10 then raise exception 'Too many tries. Check the code with your coach and try again in an hour.'; end if;
  select * into c from public.profiles where invite_code = upper(trim(code)) and role = 'coach';
  if c.id is null then insert into public.join_attempts (uid) values (auth.uid()); return null; end if;
  -- A new coach starts fresh: the previous coach's plan for this client is removed.
  delete from public.coach_plans where client_id = auth.uid() and coach_id <> c.id;
  update public.profiles set coach_id = c.id where id = auth.uid();
  return c.name;
end $$;
grant execute on function public.join_coach(text) to authenticated;

-- Becoming a coach: run ONCE for your own account after you've signed in on the dashboard, replacing the email:
--   update public.profiles set role = 'coach', invite_code = 'QK' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
--   where id = (select id from auth.users where email = 'you@example.com');
-- (Roles are never set from the app, so nobody can make themselves a coach.) Codes are 10 characters (4 billion
-- possibilities); if yours is an older 6-character one, run the line above again to get a longer one.

-- ============ Broadcasts, Fitness Age reminders, leaderboard and monthly rewards ============
-- Broadcasts are ordinary messages (kind 'broadcast', with a title), one row per client, so they show in the app
-- like any coach message. The push job sends each one as a phone notification and stamps pushed_at.
alter table public.messages add column if not exists title text;
alter table public.messages add column if not exists pushed_at timestamptz;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('cheer', 'nudge', 'note', 'broadcast'));
alter table public.profiles add column if not exists last_train date;      -- last training day (for "we miss you" and Fitness Age reminders)
alter table public.profiles add column if not exists nickname text;        -- what shows on the leaderboard (optional)
alter table public.profiles add column if not exists board_hidden boolean not null default false; -- show as "Anonymous" on the board
alter table public.profiles add column if not exists prizes jsonb;         -- coaches: { "1": "…", "2": "…", "3": "…" } for this month
alter table public.profiles add column if not exists lapse_sent date;      -- last "your Fitness Age went up" notification

-- Weekly health scores (0–100), one row per client per week (week = Monday). The client's app writes its own.
create table if not exists public.scores (
  client_id uuid not null references public.profiles (id) on delete cascade,
  week date not null,
  score int not null check (score between 0 and 100),
  parts jsonb,
  updated_at timestamptz not null default now(),
  primary key (client_id, week)
);
alter table public.scores enable row level security;
drop policy if exists "own scores" on public.scores;
create policy "own scores" on public.scores for all using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads scores" on public.scores;
create policy "coach reads scores" on public.scores for select using (public.is_my_client(client_id));
create index if not exists scores_week on public.scores (week, score desc);

-- The board everyone in a coach's community sees: rank, board name and score only (never health details).
-- Top 50 plus the caller's own row. Board name: nickname, else first name + last initial; "Anonymous" if hidden.
create or replace function public.board_name(p public.profiles) returns text language sql immutable as $$
  select case when p.board_hidden then 'Anonymous'
    when coalesce(trim(p.nickname), '') <> '' then left(trim(p.nickname), 24)
    else coalesce(nullif(split_part(trim(coalesce(p.name, '')), ' ', 1), ''), 'Shredder')
      || coalesce(' ' || nullif(upper(left(split_part(trim(coalesce(p.name, '')), ' ', 2), 1)), '') || '.', '') end $$;

create or replace function public.leaderboard(wk date, months int default 0)
returns table (rank bigint, name text, score bigint, me boolean, players bigint)
language sql stable security definer set search_path = public as $$
  with caller as (select coalesce(case when role = 'coach' then id end, coach_id) as cid from public.profiles where id = auth.uid()),
  -- Month mode: the Mondays of wk's month up to wk. Score = average points per week, counted from their first week
  -- on the board (weeks skipped after that count as 0), so someone who joins on the 15th can still win.
  m as (select date_trunc('month', wk)::date as m0),
  weeks as (select g::date as w from m, generate_series((m0 + ((8 - extract(isodow from m0)::int) % 7))::timestamp, wk::timestamp, interval '7 days') g
            where g::date < (m0 + interval '1 month')::date),
  totals as (
    select s.client_id, s.score::bigint as score from public.scores s join public.profiles p on p.id = s.client_id
    where months = 0 and p.coach_id = (select cid from caller) and s.week = wk
    union all
    select s.client_id, round(sum(s.score)::numeric / greatest(1, (select count(*) from weeks where w >= (select min(s2.week) from public.scores s2 where s2.client_id = s.client_id))))::bigint
    from public.scores s join public.profiles p on p.id = s.client_id
    where months > 0 and p.coach_id = (select cid from caller) and s.week in (select w from weeks)
    group by s.client_id),
  r as (select t.client_id, t.score, rank() over (order by t.score desc) as rank, count(*) over () as players from totals t)
  select r.rank, public.board_name(p), r.score, r.client_id = auth.uid(), r.players
  from r join public.profiles p on p.id = r.client_id
  where r.rank <= 50 or r.client_id = auth.uid() order by r.rank $$;
grant execute on function public.leaderboard(date, int) to authenticated;

-- This month's prizes, set by the coach on the dashboard, read by their clients.
create or replace function public.my_prizes() returns jsonb language sql stable security definer set search_path = public as $$
  select c.prizes from public.profiles me join public.profiles c on c.id = me.coach_id where me.id = auth.uid() $$;
grant execute on function public.my_prizes() to authenticated;

-- Monthly winners the coach records (and marks as given). The winner's app celebrates.
create table if not exists public.rewards (
  client_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  month date not null,
  place int not null check (place between 1 and 3),
  prize text,
  given_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (client_id, month)
);
alter table public.rewards enable row level security;
drop policy if exists "coach manages rewards" on public.rewards;
create policy "coach manages rewards" on public.rewards for all using (coach_id = auth.uid() and public.is_my_client(client_id)) with check (coach_id = auth.uid() and public.is_my_client(client_id));
drop policy if exists "client reads own rewards" on public.rewards;
create policy "client reads own rewards" on public.rewards for select using (client_id = auth.uid());

-- ============ Chat: clients message QK; Muhammad (QK's AI assistant) answers straight away ============
-- One row per message. sender: 'client' (the client wrote it), 'assistant' (Muhammad, written only by the server
-- with the service key, never by an app), 'coach' (QK typed it on the dashboard). A client message Muhammad hands
-- to QK (injury, pain, medicine, money…) gets `flagged` = the reason, and stays in QK's "Needs you" list until QK
-- marks it handled.
create table if not exists public.chats (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid references public.profiles (id) on delete set null,
  sender text not null check (sender in ('client', 'assistant', 'coach')),
  body text not null check (char_length(body) between 1 and 2000),
  flagged text,                 -- why it needs QK (set by the server on a client message)
  handled_at timestamptz,       -- QK dealt with it
  seen_by_coach_at timestamptz, -- QK opened the conversation after this message
  read_at timestamptz,          -- the client read it (assistant/coach messages)
  pushed_at timestamptz,        -- a phone notification went out for it (coach replies)
  created_at timestamptz not null default now()
);
create index if not exists chats_client on public.chats (client_id, created_at desc);
create index if not exists chats_flagged on public.chats (coach_id, created_at desc) where flagged is not null and handled_at is null;
alter table public.chats enable row level security;
drop policy if exists "client reads own chat" on public.chats;
create policy "client reads own chat" on public.chats for select using (client_id = auth.uid());
drop policy if exists "client writes to their coach" on public.chats;
create policy "client writes to their coach" on public.chats for insert with check (
  client_id = auth.uid() and sender = 'client' and flagged is null and handled_at is null and seen_by_coach_at is null and read_at is null and pushed_at is null
  and coach_id is not distinct from (select coach_id from public.profiles where id = auth.uid()));
drop policy if exists "coach reads client chats" on public.chats;
create policy "coach reads client chats" on public.chats for select using (public.is_my_client(client_id));
drop policy if exists "coach replies" on public.chats;
create policy "coach replies" on public.chats for insert with check (
  coach_id = auth.uid() and sender = 'coach' and public.is_my_client(client_id) and flagged is null and handled_at is null and read_at is null and pushed_at is null);
drop policy if exists "chat updates" on public.chats;
create policy "chat updates" on public.chats for update using (client_id = auth.uid() or public.is_my_client(client_id));
revoke update on public.chats from authenticated;
grant update (read_at, handled_at, seen_by_coach_at) on public.chats to authenticated;
-- Who may change which column: the client only marks replies read; only the coach marks things handled or seen.
create or replace function public.chats_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if; -- the server (service key)
  if (new.handled_at is distinct from old.handled_at or new.seen_by_coach_at is distinct from old.seen_by_coach_at) and not public.is_my_client(old.client_id) then
    raise exception 'Only the coach can mark messages handled';
  end if;
  if new.read_at is distinct from old.read_at and old.client_id <> auth.uid() then
    raise exception 'Only the client marks replies read';
  end if;
  return new;
end $$;
drop trigger if exists chats_guard on public.chats;
create trigger chats_guard before update on public.chats for each row execute function public.chats_guard();

-- Muhammad's settings live on the coach's own profile: { "name": "Muhammad", "on": true, "style": "…how QK talks…" }.
alter table public.profiles add column if not exists assistant jsonb;
-- Clients QK wants to answer himself: Muhammad stays quiet for them.
create table if not exists public.assistant_off (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.assistant_off enable row level security;
drop policy if exists "coach pauses assistant" on public.assistant_off;
create policy "coach pauses assistant" on public.assistant_off for all using (coach_id = auth.uid() and public.is_my_client(client_id)) with check (coach_id = auth.uid() and public.is_my_client(client_id));
