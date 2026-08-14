-- 기기·브라우저마다 따로 놀던 개인화 설정을 한 테이블로 동기화
-- (빠른 복사, 홈 화면 템플릿, 홈 루틴 %표시, 인사이트 즐겨찾기,
--  메모 선택 카테고리, 일기 비밀글 PIN)
-- Supabase SQL Editor → New query → 붙여넣기 → Run

create table if not exists user_settings (
  key text primary key,
  value jsonb not null default 'null',
  updated_at timestamptz not null default now()
);

comment on table user_settings is '기기 간 동기화가 필요한 개인화 설정. key = localStorage 키와 동일, value = 그 값(JSON)';

alter table user_settings enable row level security;

drop policy if exists "allow all user_settings" on user_settings;
create policy "allow all user_settings" on user_settings for all using (true) with check (true);

-- 날씨·인사이트 배경도 같은 이유로 기기마다 달랐다면 아래도 함께 실행
-- (이미 실행했다면 create table if not exists 라 그대로 넘어감)
create table if not exists user_display_settings (
  id text primary key default 'default',
  weather_bg jsonb not null default '{}',
  insight_bg jsonb not null default '{"mode": "auto"}',
  updated_at timestamptz not null default now()
);

insert into user_display_settings (id, weather_bg, insight_bg)
values ('default', '{}', '{"mode": "auto"}')
on conflict (id) do nothing;

alter table user_display_settings enable row level security;

drop policy if exists "allow all user_display_settings" on user_display_settings;
create policy "allow all user_display_settings" on user_display_settings for all using (true) with check (true);
