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

-- 지출 세부내역 (카드지출 등 한 건 하위. 세부는 키워드로 카테고리, 나머지 = 미분류)
create table if not exists budget_entry_details (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references budget_entries(id) on delete cascade,
  item text not null,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_entry_details_parent on budget_entry_details (parent_id);

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

-- 유튜브 재생목록 (노래/영상 링크 + 태그: 가수, 노래분위기, 장르)
create table if not exists youtube_playlist (
  id text primary key,
  url text not null default '',
  title text not null default '',
  sort_order integer not null default 0,
  start_seconds integer,
  tags jsonb not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_youtube_playlist_sort on youtube_playlist (sort_order);
comment on table youtube_playlist is '사이드바 재생목록. tags: 가수, 노래분위기, 장르 등';

-- ------------------------------------------------------------
-- 4. 루틴
-- ------------------------------------------------------------

-- 루틴 항목 정의 (드래그 순서는 sort_order로 유지, is_important = 중요 항목 표시)
create table if not exists routine_items (
  id serial primary key,
  title text not null,
  sort_order integer not null default 0,
  is_important boolean not null default false,
  created_at timestamptz not null default now()
);
alter table routine_items add column if not exists is_important boolean not null default false;

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
-- 6. 인사이트 (사용자가 남긴 문장 - 기기 간 동기화)
-- ------------------------------------------------------------
create table if not exists insight_entries (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text,
  created_at timestamptz not null default now()
);
alter table insight_entries add column if not exists author text;

create index if not exists idx_insight_entries_created_at on insight_entries (created_at desc);

comment on table insight_entries is '인사이트 페이지에서 사용자가 저장한 문장. PC/모바일 동기화. author=출처(인물명)';

-- ------------------------------------------------------------
-- 7. 스케줄 (사용자 등록 반복/일회성)
-- ------------------------------------------------------------
-- schedule_type: once(특정일), monthly(매월 N일), yearly(매년 M월 D일), weekly(매주 요일)
create table if not exists schedule_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  schedule_type text not null check (schedule_type in ('once', 'monthly', 'yearly', 'weekly')),
  once_date date,
  monthly_day smallint check (monthly_day is null or (monthly_day >= 1 and monthly_day <= 31)),
  yearly_month smallint check (yearly_month is null or (yearly_month >= 1 and yearly_month <= 12)),
  yearly_day smallint check (yearly_day is null or (yearly_day >= 1 and yearly_day <= 31)),
  weekly_day smallint check (weekly_day is null or (weekly_day >= 0 and weekly_day <= 6)),
  created_at timestamptz not null default now()
);

create index if not exists idx_schedule_entries_type on schedule_entries (schedule_type);
comment on table schedule_entries is '스케줄: 일회성/매월/매년/매주. 공휴일은 앱에서 별도 제공';

-- ------------------------------------------------------------
-- 8. 스케줄 완료 체크·순서·삭제한 시스템 일정 (기기 간 동기화)
-- ------------------------------------------------------------
create table if not exists schedule_completions (
  completion_key text primary key
);
comment on table schedule_completions is '스케줄 일정별 날짜 완료 체크. 기기 간 동기화용';

create table if not exists schedule_order (
  date text primary key,
  order_keys jsonb not null default '[]'
);
comment on table schedule_order is '스케줄 날짜별 항목 표시 순서. 기기 간 동기화용';

create table if not exists schedule_builtin_deleted (
  builtin_id text primary key,
  created_at timestamptz not null default now()
);
comment on table schedule_builtin_deleted is '삭제한 시스템 일정 ID';

-- ------------------------------------------------------------
-- 9. 수입 (홈·수입 페이지 기기 간 동기화)
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
comment on table income_entries is '수입 내역. 홈 위젯·수입 페이지, 모바일/PC 동기화';

-- ------------------------------------------------------------
-- 10. 메모(포스트잇) - 기기/브라우저 동기화
-- ------------------------------------------------------------
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
  height integer,
  collapsed boolean not null default false
);
create index if not exists idx_memos_deleted_at on memos (deleted_at) where deleted_at is null;
comment on table memos is '메모(포스트잇). PC/모바일 동기화';
comment on column memos.collapsed is 'true면 헤더만 표시(접힌 상태)';

-- ------------------------------------------------------------
-- 10-2. 노트(에버노트 스타일) - 노트북 + 노트, 기기 동기화
-- ------------------------------------------------------------
create table if not exists note_notebooks (
  id text primary key,
  title text not null default '노트북',
  collapsed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists note_notes (
  id text primary key,
  notebook_id text,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_note_notes_notebook_id on note_notes(notebook_id);
create index if not exists idx_note_notes_deleted_at on note_notes(deleted_at) where deleted_at is null;

-- ------------------------------------------------------------
-- 11. 수면 관리 - 날짜별 기상/취침 (기기 간 동기화)
-- ------------------------------------------------------------
create table if not exists sleep_records (
  date date primary key,
  wake_time text,
  bed_time text,
  updated_at timestamptz not null default now()
);
comment on table sleep_records is '수면: 날짜별 기상(wake_time)·취침(bed_time)';

-- ------------------------------------------------------------
-- 12. 알림 팝업 마지막 표시 (기기 간 동기화)
-- ------------------------------------------------------------
create table if not exists reminder_last_shown (
  reminder_type text primary key,
  last_shown_at timestamptz not null default now()
);
comment on table reminder_last_shown is '알림 팝업 마지막 표시 시각. shower | gym | youtube | custom-xxx 등';

-- ------------------------------------------------------------
-- 13. 팝업 알림 설정 (기기/브라우저 동기화)
-- ------------------------------------------------------------
create table if not exists popup_reminder_config (
  id text primary key default 'default',
  overrides jsonb not null default '{}',
  custom_ids jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
comment on table popup_reminder_config is '팝업 알림 설정. overrides: id별 오버라이드, custom_ids: 커스텀 팝업 id 배열';
insert into popup_reminder_config (id, overrides, custom_ids) values ('default', '{}', '[]') on conflict (id) do nothing;

-- ------------------------------------------------------------
-- RLS (Row Level Security) - 현재는 anon 허용, 나중에 auth 붙이면 user_id로 제한
-- ------------------------------------------------------------

alter table budget_entries enable row level security;
alter table budget_entry_details enable row level security;
alter table budget_keywords enable row level security;
alter table budget_month_extras enable row level security;
alter table journal_entries enable row level security;
alter table youtube_channels enable row level security;
alter table youtube_playlist enable row level security;
alter table routine_items enable row level security;
alter table routine_completions enable row level security;
alter table insight_system_quotes enable row level security;
alter table insight_entries enable row level security;
alter table schedule_entries enable row level security;
alter table schedule_completions enable row level security;
alter table schedule_order enable row level security;
alter table schedule_builtin_deleted enable row level security;
alter table income_entries enable row level security;
alter table memos enable row level security;
alter table note_notebooks enable row level security;
alter table note_notes enable row level security;
alter table sleep_records enable row level security;
alter table reminder_last_shown enable row level security;
alter table popup_reminder_config enable row level security;

-- anon 키로 모든 작업 허용 (단일 사용자/비로그인 사용 가정)
create policy "allow all budget_entries" on budget_entries for all using (true) with check (true);
create policy "allow all budget_entry_details" on budget_entry_details for all using (true) with check (true);
create policy "allow all budget_keywords" on budget_keywords for all using (true) with check (true);
create policy "allow all budget_month_extras" on budget_month_extras for all using (true) with check (true);
create policy "allow all journal_entries" on journal_entries for all using (true) with check (true);
create policy "allow all youtube_channels" on youtube_channels for all using (true) with check (true);
create policy "allow all youtube_playlist" on youtube_playlist for all using (true) with check (true);
create policy "allow all routine_items" on routine_items for all using (true) with check (true);
create policy "allow all routine_completions" on routine_completions for all using (true) with check (true);
create policy "allow all insight_system_quotes" on insight_system_quotes for all using (true) with check (true);
create policy "allow all insight_entries" on insight_entries for all using (true) with check (true);
create policy "allow all schedule_entries" on schedule_entries for all using (true) with check (true);
create policy "allow all schedule_completions" on schedule_completions for all using (true) with check (true);
create policy "allow all schedule_order" on schedule_order for all using (true) with check (true);
create policy "allow all schedule_builtin_deleted" on schedule_builtin_deleted for all using (true) with check (true);
create policy "allow all income_entries" on income_entries for all using (true) with check (true);
create policy "allow all memos" on memos for all using (true) with check (true);
create policy "allow all note_notebooks" on note_notebooks for all using (true) with check (true);
create policy "allow all note_notes" on note_notes for all using (true) with check (true);
create policy "allow all sleep_records" on sleep_records for all using (true) with check (true);
create policy "allow all reminder_last_shown" on reminder_last_shown for all using (true) with check (true);
create policy "allow all popup_reminder_config" on popup_reminder_config for all using (true) with check (true);

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
create trigger youtube_playlist_updated_at
  before update on youtube_playlist for each row execute function set_updated_at();
create trigger sleep_records_updated_at
  before update on sleep_records for each row execute function set_updated_at();
