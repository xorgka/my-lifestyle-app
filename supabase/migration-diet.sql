-- 다이어트: 날짜별 식단·운동·몸무게 (Supabase SQL Editor → New query → 붙여넣기 → Run)
-- 음식 목록·자주 먹는 조합·키/나이/성별/목표는 user_settings(키: diet-profile, diet-foods, diet-combos)에 저장됨

create table if not exists diet_days (
  date date primary key,
  meals jsonb not null default '[]'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  weight_kg numeric(5, 2),
  updated_at timestamptz not null default now()
);

comment on table diet_days is '다이어트: 날짜별 먹은 것(meals)·운동(exercises)·몸무게(weight_kg)';
comment on column diet_days.meals is '[{id, meal: breakfast|lunch|dinner|snack, name, kcal}]';
comment on column diet_days.exercises is '[{id, type: treadmill|pushup|pullup|custom, name, minutes?, incline?, speed?, reps?, kcal}]';
comment on column diet_days.weight_kg is '그날 잰 몸무게(kg). 없으면 null';

alter table diet_days enable row level security;
drop policy if exists "allow all diet_days" on diet_days;
create policy "allow all diet_days" on diet_days for all using (true) with check (true);
