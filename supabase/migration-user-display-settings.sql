-- (선택) 날씨 박스·투데이 인사이트 배경 설정을 기기/브라우저 간 동기화하려면 사용
-- 현재는 localStorage만 사용하므로 이 마이그레이션을 적용하지 않아도 동작함
-- Supabase SQL Editor → New query → 붙여넣기 → Run

create table if not exists user_display_settings (
  id text primary key default 'default',
  weather_bg jsonb not null default '{}',
  insight_bg jsonb not null default '{"mode": "auto"}',
  updated_at timestamptz not null default now()
);

comment on table user_display_settings is '날씨 박스 배경(weather_bg), 인사이트 배경(insight_bg). 기기/브라우저 동기화용. 앱에서 Supabase 연동 시 사용';
comment on column user_display_settings.weather_bg is '예: {"clear": ["url1","url2"], "rain": ["url3"]}';
comment on column user_display_settings.insight_bg is '예: {"mode": "auto"} | {"mode": "single", "url": "..."} | {"mode": "list", "urls": ["..."]}';

insert into user_display_settings (id, weather_bg, insight_bg)
values ('default', '{}', '{"mode": "auto"}')
on conflict (id) do nothing;

alter table user_display_settings enable row level security;
create policy "allow all user_display_settings" on user_display_settings for all using (true) with check (true);
