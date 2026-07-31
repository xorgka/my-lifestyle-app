-- 프로젝트 의뢰 유입 옵션 (크몽/기존고객/스레드 등). 새 의뢰 모달 드롭다운에서 사용.
-- Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run

create table if not exists production_request_sources (
  id text primary key,
  name text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table production_request_sources is '프로젝트 의뢰 유입 옵션(크몽·기존고객 등). 기기/브라우저 동기화';

create index if not exists idx_production_request_sources_sort on production_request_sources (sort_order);

alter table production_request_sources enable row level security;
drop policy if exists "allow all production_request_sources" on production_request_sources;
create policy "allow all production_request_sources" on production_request_sources for all using (true) with check (true);
