-- 메모 접기 상태 (헤더 더블클릭 시 본문 숨김). 기기/브라우저 동기화
alter table memos add column if not exists collapsed boolean not null default false;
comment on column memos.collapsed is 'true면 헤더만 표시(접힌 상태)';
