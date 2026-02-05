-- ============================================================
-- My Lifestyle App - Supabase 테이블 스키마
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 내용 붙여넣기 → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. 가계부 (구글 시트 연동 고려)
-- ------------------------------------------------------------

-- 지출 내역 (한 행 = 한 건 지출)
-- source, external_id 로 구글 시트와 동기화 시 출처·중복 방지용
create table if not exists budget_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  item text not null,
  amount integer not null check (amount >= 0),
  category text,
  source text not null default 'app' check (source in ('app', 'sheets')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_budget_entries_date on budget_entries (date);
create index if not exists idx_budget_entries_source_external on budget_entries (source, external_id) where external_id is not null;

comment on table budget_entries is '가계부 지출 내역. 구글 시트 연동 시 source=sheets, external_id=시트 행 식별자';
comment on column budget_entries.source is 'app: 앱 입력, sheets: 구글 시트에서 가져온 행';
comment on column budget_entries.external_id is '구글 시트 행 ID 등 외부 연동 시 중복/갱신용';

-- 카테고리별 키워드 (고정비/사업경비/세금/생활비/신용카드/기타)
create table if not exists budget_keywords (
  category text primary key check (category in ('고정비', '사업경비', '세금', '생활비', '신용카드', '기타')),
  keywords jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

comment on table budget_keywords is '항목명 매칭용 카테고리별 키워드. 구글 시트 연동과 무관한 앱 설정';

-- 월별 추가 키워드 (특정 연월에만 적용)
create table if not exists budget_month_extras (
  year_month text primary key,
  extras jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

comment on column budget_month_extras.extras is '예: {"사업경비": ["노션"], "생활비": ["이달의것"]}';

-- ------------------------------------------------------------
-- 2. 일기
-- ------------------------------------------------------------

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content text not null default '',
  important boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_date on journal_entries (date);

-- ------------------------------------------------------------
-- 3. 유튜브 채널 (채널별 수익·계정·메모)
-- ------------------------------------------------------------

create table if not exists youtube_channels (
  id bigint primary key,
  name text not null default '',
  channel_url text not null default '',
  category text not null default '',
  account_email text not null default '',
  password text not null default '',
  memo text not null default '',
  monthly_revenues jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table youtube_channels is '유튜브 채널 목록. monthly_revenues: {"YYYY-MM": 금액(원)}';
comment on column youtube_channels.monthly_revenues is '월별 수익 원. 예: {"2026-01": 100000}';

-- ------------------------------------------------------------
-- 4. 루틴
-- ------------------------------------------------------------

-- 루틴 항목 정의 (드래그 순서는 sort_order로 유지)
create table if not exists routine_items (
  id serial primary key,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 일별 완료 기록 (날짜 + 항목 = 한 행)
create table if not exists routine_completions (
  date date not null,
  item_id integer not null references routine_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (date, item_id)
);

create index if not exists idx_routine_completions_date on routine_completions (date);

-- ------------------------------------------------------------
-- 5. 인사이트 시스템 기본 문장 (수정·삭제 시 기기 간 동기화)
-- ------------------------------------------------------------
create table if not exists insight_system_quotes (
  id serial primary key,
  quote text not null,
  author text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_insight_system_quotes_sort on insight_system_quotes (sort_order);

-- ------------------------------------------------------------
-- RLS (Row Level Security) - 현재는 anon 허용, 나중에 auth 붙이면 user_id로 제한
-- ------------------------------------------------------------

alter table budget_entries enable row level security;
alter table budget_keywords enable row level security;
alter table budget_month_extras enable row level security;
alter table journal_entries enable row level security;
alter table youtube_channels enable row level security;
alter table routine_items enable row level security;
alter table routine_completions enable row level security;
alter table insight_system_quotes enable row level security;

-- anon 키로 모든 작업 허용 (단일 사용자/비로그인 사용 가정)
create policy "allow all budget_entries" on budget_entries for all using (true) with check (true);
create policy "allow all budget_keywords" on budget_keywords for all using (true) with check (true);
create policy "allow all budget_month_extras" on budget_month_extras for all using (true) with check (true);
create policy "allow all journal_entries" on journal_entries for all using (true) with check (true);
create policy "allow all youtube_channels" on youtube_channels for all using (true) with check (true);
create policy "allow all routine_items" on routine_items for all using (true) with check (true);
create policy "allow all routine_completions" on routine_completions for all using (true) with check (true);
create policy "allow all insight_system_quotes" on insight_system_quotes for all using (true) with check (true);

-- updated_at 자동 갱신 (선택)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger budget_entries_updated_at
  before update on budget_entries for each row execute function set_updated_at();
create trigger budget_keywords_updated_at
  before update on budget_keywords for each row execute function set_updated_at();
create trigger budget_month_extras_updated_at
  before update on budget_month_extras for each row execute function set_updated_at();
create trigger journal_entries_updated_at
  before update on journal_entries for each row execute function set_updated_at();
create trigger youtube_channels_updated_at
  before update on youtube_channels for each row execute function set_updated_at();
