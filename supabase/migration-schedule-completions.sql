-- 스케줄 "오늘 항목 체크" 완료 상태 기기/브라우저 동기화 (Supabase SQL Editor → New query → 붙여넣기 → Run)
-- completion_key 형식: user:entryId:YYYY-MM-DD 또는 builtin:builtinId:YYYY-MM-DD

create table if not exists schedule_completions (
  completion_key text primary key
);

comment on table schedule_completions is '스케줄 일정별 날짜 완료 체크. 기기 간 동기화용';

alter table schedule_completions enable row level security;
create policy "allow all schedule_completions" on schedule_completions for all using (true) with check (true);
