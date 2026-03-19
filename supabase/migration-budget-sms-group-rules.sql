-- SMS 자동입력 시 항목명을 "편의점 (상호)" 형태로 묶기 위한 규칙 (한 줄 JSON 설정)
create table if not exists budget_sms_group_config (
  id text primary key default 'default',
  rules jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

comment on table budget_sms_group_config is 'SMS 출금 항목명 묶음 규칙. rules: [{ "match": "이마트", "groupLabel": "편의점", "sortOrder": 0 }]';

insert into budget_sms_group_config (id, rules) values ('default', '[]')
on conflict (id) do nothing;

alter table budget_sms_group_config enable row level security;

create policy "allow all budget_sms_group_config" on budget_sms_group_config for all using (true) with check (true);
