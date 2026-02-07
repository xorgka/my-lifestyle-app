-- 스케줄 선택 입력: 시간(HH:mm). 없으면 null
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS time text;
