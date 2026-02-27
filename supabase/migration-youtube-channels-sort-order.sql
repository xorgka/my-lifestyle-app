-- 유튜브 채널 목록 표시 순서 (사용자 지정)
alter table youtube_channels add column if not exists sort_order integer not null default 0;
create index if not exists idx_youtube_channels_sort on youtube_channels (sort_order);
comment on column youtube_channels.sort_order is '채널 목록 표시 순서. 작을수록 위에 표시';
