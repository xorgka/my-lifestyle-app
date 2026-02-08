-- 수면 관리: 날짜별 기상/취침 시간 (Supabase SQL Editor → New query → 붙여넣기 → Run)
-- 기상 시간 팝업·수면 페이지 데이터를 PC·스마트폰에서 동기화할 때 사용

create table if not exists sleep_records (
  date date primary key,
  wake_time text,
  bed_time text,
  updated_at timestamptz not null default now()
);

comment on table sleep_records is '수면 관리: 날짜별 기상(wake_time)·취침(bed_time). bed_time=해당 날짜로 잔 밤의 취침 시각';
comment on column sleep_records.wake_time is '기상 시각 HH:mm';
comment on column sleep_records.bed_time is '취침 시각 HH:mm (해당 날짜 아침에 잔 밤)';

alter table sleep_records enable row level security;
create policy "allow all sleep_records" on sleep_records for all using (true) with check (true);

create trigger sleep_records_updated_at
  before update on sleep_records for each row execute function set_updated_at();
