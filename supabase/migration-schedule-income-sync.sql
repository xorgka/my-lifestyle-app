-- ============================================================
-- 스케줄·홈 기기 간 동기화용 추가 테이블 (New query 에서 실행)
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. 스케줄: 시스템(builtin) 일정 삭제 목록 (기기 간 동기화)
-- ------------------------------------------------------------
create table if not exists schedule_builtin_deleted (
  builtin_id text primary key,
  created_at timestamptz not null default now()
);

comment on table schedule_builtin_deleted is '삭제한 시스템 일정 ID. 예: birthday:2:10:창환 생일, once:2026-02-06:동계올림픽';

alter table schedule_builtin_deleted enable row level security;
create policy "allow all schedule_builtin_deleted" on schedule_builtin_deleted for all using (true) with check (true);

-- ------------------------------------------------------------
-- 2. 수입 (income) - 홈·수입 페이지 기기 간 동기화
-- ------------------------------------------------------------
create table if not exists income_entries (
  id text primary key,
  year smallint not null,
  month smallint not null check (month >= 1 and month <= 12),
  item text not null default '',
  amount bigint not null,
  category text not null default '기타',
  created_at timestamptz not null default now()
);

create index if not exists idx_income_entries_year_month on income_entries (year, month);

comment on table income_entries is '수입 내역. 홈 위젯·수입 페이지에서 사용, 모바일/PC 동기화';

alter table income_entries enable row level security;
create policy "allow all income_entries" on income_entries for all using (true) with check (true);
