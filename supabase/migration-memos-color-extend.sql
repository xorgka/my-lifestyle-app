-- ============================================================
-- 메모 color에 주황·웜그레이 허용 (이미 memos 테이블 있는 경우 실행)
-- Supabase SQL Editor에서 이 파일만 실행
-- ============================================================

alter table memos drop constraint if exists memos_color_check;
alter table memos add constraint memos_color_check check (
  color in ('black', 'wine', 'purple', 'orange', 'warmgray')
);
