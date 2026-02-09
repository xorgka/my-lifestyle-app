-- 유튜브 실제 입금 금액 (국민 6954/8189 등 계좌별·연월별). 기기/브라우저 동기화용.
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run

-- 1) 테이블 생성
create table if not exists youtube_actual_deposits (
  deposit_key text primary key,
  amount_krw integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table youtube_actual_deposits is '유튜브 실제 입금 금액. deposit_key 예: 국민6954-2026-02, 국민8189-2026-02. amount_krw=원';

-- 2) RLS
alter table youtube_actual_deposits enable row level security;
drop policy if exists "allow all youtube_actual_deposits" on youtube_actual_deposits;
create policy "allow all youtube_actual_deposits" on youtube_actual_deposits for all using (true) with check (true);

-- 3) updated_at 트리거 (함수는 schema.sql 등에 이미 있으면 생략 가능)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists youtube_actual_deposits_updated_at on youtube_actual_deposits;
create trigger youtube_actual_deposits_updated_at
  before update on youtube_actual_deposits for each row execute function set_updated_at();
