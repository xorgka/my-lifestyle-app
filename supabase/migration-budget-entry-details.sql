-- budget_entry_details 테이블 추가 (카드지출 세부내역)
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run
-- ※ budget_entries 테이블이 이미 있어야 합니다.

-- 테이블 생성
create table if not exists budget_entry_details (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references budget_entries(id) on delete cascade,
  item text not null,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_budget_entry_details_parent on budget_entry_details (parent_id);

-- RLS 활성화 + 모두 허용 정책 (앱에서 읽기/쓰기 가능하도록)
alter table budget_entry_details enable row level security;

drop policy if exists "allow all budget_entry_details" on budget_entry_details;
create policy "allow all budget_entry_details" on budget_entry_details for all using (true) with check (true);
