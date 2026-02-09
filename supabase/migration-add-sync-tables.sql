-- ============================================================
-- 이미 예전에 schema.sql 넣은 적 있으면 → 이 파일만 실행하세요.
-- (전체 schema.sql 다시 넣을 필요 없음)
-- Supabase 대시보드 → SQL Editor → New query → 이 내용 붙여넣기 → Run
-- ============================================================

-- 스케줄 완료·순서·삭제한 시스템 일정
create table if not exists schedule_completions (
  completion_key text primary key
);
create table if not exists schedule_order (
  date text primary key,
  order_keys jsonb not null default '[]'
);
create table if not exists schedule_builtin_deleted (
  builtin_id text primary key,
  created_at timestamptz not null default now()
);

-- 수입
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

-- 메모(포스트잇)
create table if not exists memos (
  id text primary key,
  content text not null default '',
  created_at timestamptz not null default now(),
  color text not null default 'black' check (color in ('black', 'wine', 'purple', 'orange', 'warmgray')),
  pinned boolean not null default false,
  pinned_at timestamptz,
  title text,
  deleted_at timestamptz,
  x integer,
  y integer,
  width integer,
  height integer
);
create index if not exists idx_memos_deleted_at on memos (deleted_at) where deleted_at is null;

-- 수면
create table if not exists sleep_records (
  date date primary key,
  wake_time text,
  bed_time text,
  updated_at timestamptz not null default now()
);

-- 알림 팝업 마지막 표시
create table if not exists reminder_last_shown (
  reminder_type text primary key,
  last_shown_at timestamptz not null default now()
);

-- RLS + 정책
alter table schedule_completions enable row level security;
alter table schedule_order enable row level security;
alter table schedule_builtin_deleted enable row level security;
alter table income_entries enable row level security;
alter table memos enable row level security;
alter table sleep_records enable row level security;
alter table reminder_last_shown enable row level security;

drop policy if exists "allow all schedule_completions" on schedule_completions;
create policy "allow all schedule_completions" on schedule_completions for all using (true) with check (true);
drop policy if exists "allow all schedule_order" on schedule_order;
create policy "allow all schedule_order" on schedule_order for all using (true) with check (true);
drop policy if exists "allow all schedule_builtin_deleted" on schedule_builtin_deleted;
create policy "allow all schedule_builtin_deleted" on schedule_builtin_deleted for all using (true) with check (true);
drop policy if exists "allow all income_entries" on income_entries;
create policy "allow all income_entries" on income_entries for all using (true) with check (true);
drop policy if exists "allow all memos" on memos;
create policy "allow all memos" on memos for all using (true) with check (true);
drop policy if exists "allow all sleep_records" on sleep_records;
create policy "allow all sleep_records" on sleep_records for all using (true) with check (true);
drop policy if exists "allow all reminder_last_shown" on reminder_last_shown;
create policy "allow all reminder_last_shown" on reminder_last_shown for all using (true) with check (true);

-- sleep_records updated_at 트리거 (set_updated_at 함수는 schema.sql에 이미 있음)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sleep_records_updated_at on sleep_records;
create trigger sleep_records_updated_at
  before update on sleep_records for each row execute function set_updated_at();
