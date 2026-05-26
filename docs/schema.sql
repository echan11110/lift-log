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
create index if not exists idx_sets_exercise         on sets (exercise_id, set_number);
create index if not exists idx_dropsets_set          on dropsets (set_id, drop_order);
