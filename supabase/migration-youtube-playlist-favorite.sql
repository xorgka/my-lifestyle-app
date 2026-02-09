-- 즐겨찾기 컬럼 추가 (재생목록 항목별)
alter table youtube_playlist add column if not exists favorite boolean not null default false;
comment on column youtube_playlist.favorite is '즐겨찾기 여부';
