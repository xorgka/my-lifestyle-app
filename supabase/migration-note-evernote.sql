-- 노트(에버노트 스타일): 노트북 + 노트. 기기/브라우저 동기화

-- 노트북 (열고 닫기, 제목 수정)
create table if not exists note_notebooks (
  id text primary key,
  title text not null default '노트북',
  collapsed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table note_notebooks is '노트북. 여러 노트를 묶음. 펼치기/접기 가능';

-- 노트 (노트북에 속하거나 없음, 휴지통 지원)
create table if not exists note_notes (
  id text primary key,
  notebook_id text,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table note_notes is '노트. notebook_id 있으면 해당 노트북 소속. deleted_at 있으면 휴지통';

create index if not exists idx_note_notes_notebook_id on note_notes(notebook_id);
create index if not exists idx_note_notes_deleted_at on note_notes(deleted_at) where deleted_at is null;

alter table note_notebooks enable row level security;
alter table note_notes enable row level security;
create policy "allow all note_notebooks" on note_notebooks for all using (true) with check (true);
create policy "allow all note_notes" on note_notes for all using (true) with check (true);
