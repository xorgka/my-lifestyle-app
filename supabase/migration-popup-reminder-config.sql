-- 팝업 알림 설정 기기/브라우저 간 동기화 (Supabase SQL Editor → New query → 붙여넣기 → Run)
-- 설정 모달 > 팝업 탭에서 수정한 문구·체크항목·배경/글자색·커스텀 팝업 목록이 한 행에 저장됨

create table if not exists popup_reminder_config (
  id text primary key default 'default',
  overrides jsonb not null default '{}',
  custom_ids jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

comment on table popup_reminder_config is '팝업 알림 설정. overrides: id별 설정 오버라이드, custom_ids: 커스텀 팝업 id 배열. 기기/브라우저 동기화용';
comment on column popup_reminder_config.overrides is '예: {"shower": {"title": "..."}, "custom-xxx": {"title": "...", "routineTitle": "..."}}';
comment on column popup_reminder_config.custom_ids is '예: ["custom-xxx", "custom-yyy"]';

-- 한 행만 유지 (upsert로 id='default' 사용)
insert into popup_reminder_config (id, overrides, custom_ids)
values ('default', '{}', '[]')
on conflict (id) do nothing;

alter table popup_reminder_config enable row level security;
create policy "allow all popup_reminder_config" on popup_reminder_config for all using (true) with check (true);
