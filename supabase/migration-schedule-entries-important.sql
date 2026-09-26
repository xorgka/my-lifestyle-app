-- 스케줄 중요 표시(별표): 달력·목록에서 다른 색으로 보임
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS important boolean NOT NULL DEFAULT false;
