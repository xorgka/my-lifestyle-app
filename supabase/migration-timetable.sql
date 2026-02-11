-- 타임테이블: 날짜별 시간대·항목·완료 (루틴 타임테이블 페이지)
-- SQL Editor → New query → 붙여넣기 → Run

create table if not exists timetable_days (
  date_key text primary key,
  slots jsonb not null default '[]',
  completed_ids jsonb not null default '[]'
);

comment on table timetable_days is '타임테이블: 날짜(YYYY-MM-DD)별 시간대·항목·완료 ID 목록';

alter table timetable_days enable row level security;
drop policy if exists "allow all timetable_days" on timetable_days;
create policy "allow all timetable_days" on timetable_days for all using (true) with check (true);
