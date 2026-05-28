-- 포스트잇 겹침 순서 (z-index). 선택·새 메모가 위로 오도록 앱에서 stack_order 사용
alter table memos add column if not exists stack_order integer;
comment on column memos.stack_order is '캔버스 겹침 순서. 클 수록 위에 그림';
