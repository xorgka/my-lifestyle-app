-- 가계부 저장이 안 될 때: RLS 정책만 적용하기
-- Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run

-- 이미 정책이 있으면 "already exists" 에러가 날 수 있음. 그럴 땐 아래 한 줄씩 실행하거나, 기존 정책 삭제 후 다시 실행.

alter table budget_entries enable row level security;
alter table budget_keywords enable row level security;
alter table budget_month_extras enable row level security;

drop policy if exists "allow all budget_entries" on budget_entries;
drop policy if exists "allow all budget_keywords" on budget_keywords;
drop policy if exists "allow all budget_month_extras" on budget_month_extras;

create policy "allow all budget_entries" on budget_entries for all using (true) with check (true);
create policy "allow all budget_keywords" on budget_keywords for all using (true) with check (true);
create policy "allow all budget_month_extras" on budget_month_extras for all using (true) with check (true);
