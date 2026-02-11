-- 타임테이블 항목 ↔ 루틴 항목 연동 (기기·브라우저 간 동기화)
-- Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run

create table if not exists timetable_routine_links (
  timetable_item_id text primary key,
  routine_item_id integer not null
);

comment on table timetable_routine_links is '타임테이블 항목 id → 루틴 항목 id 연동. 타임테이블 완료 시 루틴 완료와 동기화';

alter table timetable_routine_links enable row level security;
drop policy if exists "allow all timetable_routine_links" on timetable_routine_links;
create policy "allow all timetable_routine_links" on timetable_routine_links for all using (true) with check (true);
