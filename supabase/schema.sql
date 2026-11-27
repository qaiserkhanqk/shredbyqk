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
create policy "coach writes plans" on public.coach_plans for all using (coach_id = auth.uid() and public.is_my_client(client_id)) with check (coach_id = auth.uid() and public.is_my_client(client_id));
drop policy if exists "client reads own plan" on public.coach_plans;
create policy "client reads own plan" on public.coach_plans for select using (client_id = auth.uid());

-- Joining a coach: a client calls this with the coach's invite code. Returns the coach's name.
create or replace function public.join_coach(code text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.profiles;
begin
  select * into c from public.profiles where invite_code = upper(trim(code)) and role = 'coach';
  if c.id is null then raise exception 'No coach with that code'; end if;
  update public.profiles set coach_id = c.id where id = auth.uid();
  return c.name;
end $$;
grant execute on function public.join_coach(text) to authenticated;

-- Becoming a coach: run ONCE for your own account after you've signed in on the dashboard, replacing the email:
--   update public.profiles set role = 'coach', invite_code = 'QK' || upper(substr(md5(random()::text), 1, 4))
--   where id = (select id from auth.users where email = 'you@example.com');
-- (Roles are never set from the app, so nobody can make themselves a coach.)
