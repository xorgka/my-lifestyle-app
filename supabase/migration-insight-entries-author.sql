-- insight_entries 테이블에 author 컬럼 추가 (기존 DB에 컬럼이 없을 때 실행)
-- Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run

alter table insight_entries add column if not exists author text;

comment on column insight_entries.author is '출처(인물명). 인사이트 문장의 저자/발언자';
