-- 일기 비밀글(secret) 컬럼 + 일기 초안(journal_drafts) 테이블
-- 기기·브라우저 간 일기 및 초안 동기화용. SQL Editor에서 한 번 실행.

-- 1) journal_entries에 secret 컬럼 추가 (비밀글)
alter table journal_entries
  add column if not exists secret boolean not null default false;

comment on column journal_entries.secret is '비밀글이면 달력/검색 등에서 내용 미리보기 숨김';

-- 2) 일기 초안 테이블 (저장 전 미저장 글 동기화)
create table if not exists journal_drafts (
  date text primary key,
  content text not null default '',
  important boolean not null default false,
  secret boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table journal_drafts is '일기 초안. 기기·브라우저 간 동기화, 새로고침 시에도 유지';

-- RLS (기존 정책과 동일: anon 허용)
alter table journal_drafts enable row level security;

drop policy if exists "allow all journal_drafts" on journal_drafts;
create policy "allow all journal_drafts" on journal_drafts for all using (true) with check (true);
