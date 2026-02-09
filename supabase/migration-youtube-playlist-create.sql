-- youtube_playlist 테이블이 없을 때 한 번만 실행하세요.
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run

-- 1) 테이블 생성
create table if not exists youtube_playlist (
  id text primary key,
  url text not null default '',
  title text not null default '',
  sort_order integer not null default 0,
  start_seconds integer,
  tags jsonb not null default '{}',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 인덱스·코멘트
create index if not exists idx_youtube_playlist_sort on youtube_playlist (sort_order);
comment on table youtube_playlist is '사이드바 재생목록. tags: 가수, 노래분위기, 장르 등';

-- 3) RLS 켜기 + 누구나 읽기/쓰기 허용
alter table youtube_playlist enable row level security;
drop policy if exists "allow all youtube_playlist" on youtube_playlist;
create policy "allow all youtube_playlist" on youtube_playlist for all using (true) with check (true);

-- 4) updated_at 자동 갱신 (함수 없으면 생성)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists youtube_playlist_updated_at on youtube_playlist;
create trigger youtube_playlist_updated_at
  before update on youtube_playlist for each row execute function set_updated_at();
