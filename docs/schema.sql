-- ============================================================
-- Lift Log — Supabase Schema
-- Run this in the Supabase SQL editor (Settings > SQL Editor)
-- ============================================================

-- workout_sessions
create table if not exists workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  split_type  text not null check (split_type in ('Push','Pull','Legs','Arms')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

-- Note: exercise_order, set_number, drop_order are maintained contiguous app-side on delete.

-- exercises
create table if not exists exercises (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references workout_sessions on delete cascade,
  name            text not null,
  exercise_order  int  not null,
  created_at      timestamptz not null default now()
);

-- sets
create table if not exists sets (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises on delete cascade,
  set_number  int  not null,
  weight      numeric not null,
  reps        int  not null,
  created_at  timestamptz not null default now()
);

-- dropsets
create table if not exists dropsets (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references sets on delete cascade,
  drop_order int  not null,
  weight     numeric not null,
  reps       int  not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table workout_sessions enable row level security;
alter table exercises         enable row level security;
alter table sets              enable row level security;
alter table dropsets          enable row level security;

-- workout_sessions: owned by the authenticated user
create policy "Users own their sessions"
  on workout_sessions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- exercises: accessible if the parent session belongs to the user
create policy "Users own their exercises"
  on exercises for all
  using  (exists (select 1 from workout_sessions ws where ws.id = exercises.session_id and ws.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions ws where ws.id = exercises.session_id and ws.user_id = auth.uid()));

-- sets: accessible if the parent exercise → session belongs to the user
create policy "Users own their sets"
  on sets for all
  using  (exists (
    select 1 from exercises ex
    join workout_sessions ws on ws.id = ex.session_id
    where ex.id = sets.exercise_id and ws.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from exercises ex
    join workout_sessions ws on ws.id = ex.session_id
    where ex.id = sets.exercise_id and ws.user_id = auth.uid()
  ));

-- dropsets: accessible if the grandparent session belongs to the user
create policy "Users own their dropsets"
  on dropsets for all
  using  (exists (
    select 1 from sets s
    join exercises ex on ex.id = s.exercise_id
    join workout_sessions ws on ws.id = ex.session_id
    where s.id = dropsets.set_id and ws.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from sets s
    join exercises ex on ex.id = s.exercise_id
    join workout_sessions ws on ws.id = ex.session_id
    where s.id = dropsets.set_id and ws.user_id = auth.uid()
  ));

-- ============================================================
-- Indexes for common query patterns
-- ============================================================

create index if not exists idx_sessions_user_date   on workout_sessions (user_id, date);
create index if not exists idx_exercises_session     on exercises (session_id, exercise_order);
create index if not exists idx_exercises_name        on exercises (name);
create index if not exists idx_sets_exercise         on sets (exercise_id, set_number);
create index if not exists idx_dropsets_set          on dropsets (set_id, drop_order);

-- ============================================================
-- RPCs
-- ============================================================

-- Returns sorted distinct strength exercise names for a user.
create or replace function distinct_exercise_names(p_user_id uuid)
returns setof text language sql stable as $$
  select distinct e.name
  from exercises e
  join workout_sessions ws on ws.id = e.session_id
  where ws.user_id = p_user_id
    and e.exercise_type = 'strength'
  order by 1
$$;
grant execute on function distinct_exercise_names(uuid) to authenticated;

-- Returns sorted distinct cardio activity names for a user.
create or replace function distinct_cardio_names(p_user_id uuid)
returns setof text language sql stable as $$
  select distinct e.name
  from exercises e
  join workout_sessions ws on ws.id = e.session_id
  where ws.user_id = p_user_id
    and e.exercise_type = 'cardio'
  order by 1
$$;
grant execute on function distinct_cardio_names(uuid) to authenticated;

-- ============================================================
-- Migration v2 — Custom Splits + Cardio
-- Run this block in Supabase SQL Editor AFTER the base schema.
-- All steps are idempotent (safe to re-run).
-- ============================================================

-- 1. Split template tables
create table if not exists split_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists split_days (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references split_templates on delete cascade,
  day_index     int  not null,
  label         text not null,
  muscle_groups text[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique (template_id, day_index)
);

-- 2. Seed system default (fixed UUID for idempotency)
insert into split_templates (id, user_id, name) values
  ('00000000-0000-0000-0000-000000000001', null, 'Push / Pull / Legs / Arms')
  on conflict (id) do nothing;

insert into split_days (template_id, day_index, label, muscle_groups) values
  ('00000000-0000-0000-0000-000000000001', 0, 'Push', '{chest,front_delt,side_delt,triceps}'),
  ('00000000-0000-0000-0000-000000000001', 1, 'Pull', '{back,lats,traps,rear_delt,biceps}'),
  ('00000000-0000-0000-0000-000000000001', 2, 'Legs', '{quads,hamstrings,glutes,calves}'),
  ('00000000-0000-0000-0000-000000000001', 3, 'Arms', '{biceps,triceps,forearms}')
  on conflict do nothing;

-- 3. Add split_day_id to workout_sessions (nullable FK)
alter table workout_sessions
  add column if not exists split_day_id uuid references split_days(id) on delete set null;

-- 4. Backfill split_day_id from existing split_type values
update workout_sessions ws
set split_day_id = sd.id
from split_days sd
join split_templates st on st.id = sd.template_id
where st.user_id is null
  and sd.label = ws.split_type
  and ws.split_day_id is null;

-- 5. Drop the CHECK constraint on split_type (enables custom labels)
alter table workout_sessions
  drop constraint if exists workout_sessions_split_type_check;

-- 6. Make split_type nullable (free sessions have no split)
alter table workout_sessions
  alter column split_type drop not null;

-- 7. Exercise type discriminator (default covers all existing rows)
alter table exercises
  add column if not exists exercise_type text not null default 'strength'
    check (exercise_type in ('strength', 'cardio'));

-- 8. Cardio entries table
create table if not exists cardio_entries (
  id               uuid primary key default gen_random_uuid(),
  exercise_id      uuid not null references exercises on delete cascade,
  duration_sec     int not null,
  distance_m       numeric,
  avg_pace_sec     int,
  calories         int,
  resistance_level text,
  created_at       timestamptz not null default now()
);

-- 9. RLS for new tables
alter table split_templates enable row level security;
alter table split_days      enable row level security;
alter table cardio_entries  enable row level security;

create policy "Read system and own templates"
  on split_templates for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users insert their own templates"
  on split_templates for insert
  with check (auth.uid() = user_id);

create policy "Users update their own templates"
  on split_templates for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own templates"
  on split_templates for delete
  using (auth.uid() = user_id);

create policy "Read days of accessible templates"
  on split_days for select
  using (exists (
    select 1 from split_templates st
    where st.id = split_days.template_id
      and (st.user_id is null or st.user_id = auth.uid())
  ));

create policy "Users insert days of their templates"
  on split_days for insert
  with check (exists (
    select 1 from split_templates st
    where st.id = split_days.template_id and st.user_id = auth.uid()
  ));

create policy "Users update days of their templates"
  on split_days for update
  using (exists (
    select 1 from split_templates st
    where st.id = split_days.template_id and st.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from split_templates st
    where st.id = split_days.template_id and st.user_id = auth.uid()
  ));

create policy "Users delete days of their templates"
  on split_days for delete
  using (exists (
    select 1 from split_templates st
    where st.id = split_days.template_id and st.user_id = auth.uid()
  ));

create policy "Users own their cardio entries"
  on cardio_entries for all
  using (exists (
    select 1 from exercises ex
    join workout_sessions ws on ws.id = ex.session_id
    where ex.id = cardio_entries.exercise_id and ws.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from exercises ex
    join workout_sessions ws on ws.id = ex.session_id
    where ex.id = cardio_entries.exercise_id and ws.user_id = auth.uid()
  ));

-- 10. Indexes for new tables
create index if not exists idx_split_days_template   on split_days (template_id, day_index);
create index if not exists idx_cardio_entries_exercise on cardio_entries (exercise_id);
