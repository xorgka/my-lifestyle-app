-- 스케줄 날짜별 항목 순서(드래그 순서) 기기/브라우저 동기화 (Supabase SQL Editor → New query → 붙여넣기 → Run)
-- date = YYYY-MM-DD, order_keys = 문자열 배열(jsonb)

create table if not exists schedule_order (
  date text primary key,
  order_keys jsonb not null default '[]'
);

comment on table schedule_order is '스케줄 날짜별 항목 표시 순서. 기기 간 동기화용';

alter table schedule_order enable row level security;
create policy "allow all schedule_order" on schedule_order for all using (true) with check (true);
