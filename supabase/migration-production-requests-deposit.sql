-- 프로젝트(제작 의뢰) 결제 단계에 "선금만 받음" 표시용 선금액 컬럼 추가.
-- 구글 시트에는 없는 필드라 앱 안에서만 쓰고 시트에는 동기화하지 않음.
-- Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run

alter table production_requests add column if not exists deposit_amount numeric not null default 0;

comment on column production_requests.deposit_amount is '결제 단계에서 선금만 받은 경우의 선금액 (0이면 선금 없음)';
