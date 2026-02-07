-- ============================================================
-- 메모(포스트잇) 테이블 - 기기/모바일 동기화
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 붙여넣기 → Run
-- ============================================================

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
comment on table memos is '메모(포스트잇). PC/모바일 동기화. deleted_at 있으면 휴지통.';

alter table memos enable row level security;
create policy "allow all memos" on memos for all using (true) with check (true);
