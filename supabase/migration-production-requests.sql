-- 프로젝트(홈페이지&로고 제작 의뢰) 관리. 구글 시트 "홈페이지&로고 제작 진행과정" 대체.
-- Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run

create table if not exists production_requests (
  id uuid primary key default gen_random_uuid(),
  year_month text not null, -- 예: "2026-07" (시트 탭 매칭용)
  request_date date not null,
  client_name text not null default '',
  source text not null default '', -- 유입: 크몽/기존
  inquiry_channel text not null default '', -- 문의 ID
  category text not null default '', -- 업종
  amount numeric not null default 0, -- 금액
  net_profit numeric not null default 0, -- 순수익
  note text not null default '', -- 비고
  -- 진행상황 7단계. 시트와 동일한 값만 사용: '' | '~'(진행중) | 'O'(완료)
  status_guide text not null default '',
  status_payment text not null default '',
  status_invoice text not null default '',
  status_material text not null default '',
  status_production text not null default '',
  status_revision text not null default '',
  status_complete text not null default '',
  sheet_row integer, -- 구글 시트 상 매핑된 행 번호. null이면 아직 시트에 반영 안 됨
  sheet_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table production_requests is '홈페이지&로고 제작 의뢰 관리. 저장 시 구글 시트로 단방향 동기화됨(sheet_row로 매핑).';

create index if not exists production_requests_year_month_idx on production_requests (year_month, request_date);

alter table production_requests enable row level security;

drop policy if exists "allow all production_requests" on production_requests;
create policy "allow all production_requests" on production_requests for all using (true) with check (true);

drop trigger if exists production_requests_updated_at on production_requests;
create trigger production_requests_updated_at
  before update on production_requests for each row execute function set_updated_at();
