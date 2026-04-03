-- 홈 알림바: 설정「알림바」탭 — 시스템 문구 오버라이드(멘트 5종 등) + 사용자 추가 문구
-- SQL Editor → Run 한 번

create table if not exists alert_bar_settings (
  id text primary key default 'default',
  system_overrides jsonb not null default '{}',
  custom_alerts jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

comment on table alert_bar_settings is '알림바: system_overrides = 멘트/수면/일정 등 키별 {disabled, customText}, custom_alerts = 사용자 추가 슬롯';
insert into alert_bar_settings (id, system_overrides, custom_alerts)
values ('default', '{}', '[]')
on conflict (id) do nothing;

alter table alert_bar_settings enable row level security;
drop policy if exists "allow all alert_bar_settings" on alert_bar_settings;
create policy "allow all alert_bar_settings" on alert_bar_settings for all using (true) with check (true);
