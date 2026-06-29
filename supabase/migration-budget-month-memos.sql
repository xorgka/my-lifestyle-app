-- 기간별 보기 월별 자유 메모 (year_month → 텍스트). 모달에서 자동저장.
create table if not exists budget_month_memos (
  year_month text primary key,
  memo text not null default '',
  updated_at timestamptz not null default now()
);

comment on table budget_month_memos is '가계부 기간별 보기 월별 메모. 예: { "year_month": "2026-05", "memo": "5월 메모" }';

alter table budget_month_memos enable row level security;

create policy "allow all budget_month_memos" on budget_month_memos for all using (true) with check (true);

create trigger budget_month_memos_updated_at
  before update on budget_month_memos for each row execute function set_updated_at();
