-- 알림 팝업 "마지막 표시" 기기/브라우저 간 동기화 (Supabase SQL Editor → New query → 붙여넣기 → Run)
-- shower, gym, youtube 등 타입별로 한 행씩, last_shown_at으로 throttle 판단

create table if not exists reminder_last_shown (
  reminder_type text primary key,
  last_shown_at timestamptz not null default now()
);

comment on table reminder_last_shown is '알림 팝업 마지막 표시 시각. 기기/브라우저 간 동기화용';
comment on column reminder_last_shown.reminder_type is 'shower | gym | youtube';

alter table reminder_last_shown enable row level security;
create policy "allow all reminder_last_shown" on reminder_last_shown for all using (true) with check (true);
