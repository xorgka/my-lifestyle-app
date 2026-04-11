-- 타임테이블: 이름 있는 저장 템플릿 여러 개 (라이브러리)
-- SQL Editor → New query → 붙여넣기 → Run

create table if not exists timetable_named_templates (
  id text primary key,
  name text not null default '',
  slots jsonb not null default '[]',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table timetable_named_templates is '타임테이블: 사용자 저장 템플릿(이름·시간대·항목). 여러 개 보관·선택 적용. 기기/브라우저 동기화';

create index if not exists idx_timetable_named_templates_sort on timetable_named_templates (sort_order);

alter table timetable_named_templates enable row level security;
drop policy if exists "allow all timetable_named_templates" on timetable_named_templates;
create policy "allow all timetable_named_templates" on timetable_named_templates for all using (true) with check (true);
