-- 타임테이블 부가 데이터: 날짜별 시작시간 오버라이드, 저장 템플릿, (시간+텍스트) 루틴 연동
-- 기기/브라우저 간 동기화. SQL Editor → New query → 붙여넣기 → Run

-- 1) 날짜별 시작시간 오버라이드 (0~23)
create table if not exists timetable_start_time_overrides (
  date_key text primary key,
  hour smallint not null check (hour >= 0 and hour <= 23)
);
comment on table timetable_start_time_overrides is '타임테이블: 날짜별 시작시간 오버라이드(0~23). 기기/브라우저 동기화';

alter table timetable_start_time_overrides enable row level security;
drop policy if exists "allow all timetable_start_time_overrides" on timetable_start_time_overrides;
create policy "allow all timetable_start_time_overrides" on timetable_start_time_overrides for all using (true) with check (true);

-- 2) 저장한 타임테이블 템플릿 (시간대·항목 구조 1개)
create table if not exists timetable_saved_template (
  id text primary key default 'default',
  slots jsonb not null default '[]'
);
comment on table timetable_saved_template is '타임테이블: 사용자 저장 템플릿(시간대·항목 구조). 기기/브라우저 동기화';

alter table timetable_saved_template enable row level security;
drop policy if exists "allow all timetable_saved_template" on timetable_saved_template;
create policy "allow all timetable_saved_template" on timetable_saved_template for all using (true) with check (true);

-- 3) (시간대+텍스트) → 루틴 ID 템플릿 연동
create table if not exists timetable_routine_template_links (
  time_text_key text primary key,
  routine_item_id integer not null
);
comment on table timetable_routine_template_links is '타임테이블: (시간\\0텍스트) → 루틴 항목 ID. 같은 시간·텍스트면 다른 날에도 루틴 연동. 기기/브라우저 동기화';

alter table timetable_routine_template_links enable row level security;
drop policy if exists "allow all timetable_routine_template_links" on timetable_routine_template_links;
create policy "allow all timetable_routine_template_links" on timetable_routine_template_links for all using (true) with check (true);
