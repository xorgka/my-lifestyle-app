-- ============================================================
-- 하루에 일기 여러 개 쓰기 (New query 에서 실행)
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run
-- ============================================================

-- journal_entries: date 단독 unique 제약을 (date, seq) 복합으로 교체
alter table journal_entries drop constraint if exists journal_entries_date_key;
alter table journal_entries add column if not exists seq smallint not null default 1;
alter table journal_entries drop constraint if exists journal_entries_date_seq_key;
alter table journal_entries add constraint journal_entries_date_seq_key unique (date, seq);

-- journal_drafts: date 단독 PK를 (date, seq) 복합 PK로 교체
alter table journal_drafts drop constraint if exists journal_drafts_pkey;
alter table journal_drafts add column if not exists seq smallint not null default 1;
alter table journal_drafts add constraint journal_drafts_pkey primary key (date, seq);
