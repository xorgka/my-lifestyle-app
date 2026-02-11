-- ============================================================
-- 노트 + 메모 기기/모바일/브라우저 연동용 통합 마이그레이션
-- Supabase 대시보드 → SQL Editor → New query → 이 전체 붙여넣기 → Run
-- 실행 후 앱에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 설정하면
-- 모든 기기에서 노트·메모가 동기화됩니다.
-- ============================================================

-- ----- 노트북 -----
create table if not exists note_notebooks (
  id text primary key,
  title text not null default '',
  collapsed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table note_notebooks is '노트북. 여러 노트를 묶음. 기기/브라우저 동기화';

-- ----- 노트 -----
create table if not exists note_notes (
  id text primary key,
  notebook_id text,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table note_notes is '노트. deleted_at 있으면 휴지통. 기기/브라우저 동기화';

create index if not exists idx_note_notes_notebook_id on note_notes(notebook_id);
create index if not exists idx_note_notes_updated_at on note_notes(updated_at desc);
create index if not exists idx_note_notes_deleted_at on note_notes(deleted_at) where deleted_at is null;

-- ----- 메모(포스트잇) -----
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
comment on table memos is '메모(포스트잇). 기기/모바일/브라우저 동기화. deleted_at 있으면 휴지통.';

create index if not exists idx_memos_deleted_at on memos (deleted_at) where deleted_at is null;
create index if not exists idx_memos_created_at on memos (created_at);

-- 기존 memos 테이블에 collapsed 없으면 추가
alter table memos add column if not exists collapsed boolean not null default false;

-- ----- RLS (Row Level Security) -----
alter table note_notebooks enable row level security;
alter table note_notes enable row level security;
alter table memos enable row level security;

drop policy if exists "allow all note_notebooks" on note_notebooks;
drop policy if exists "allow all note_notes" on note_notes;
drop policy if exists "allow all memos" on memos;

create policy "allow all note_notebooks" on note_notebooks for all using (true) with check (true);
create policy "allow all note_notes" on note_notes for all using (true) with check (true);
create policy "allow all memos" on memos for all using (true) with check (true);
