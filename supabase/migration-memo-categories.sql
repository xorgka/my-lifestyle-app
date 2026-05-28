-- 포스트잇 메모 카테고리 + memos.category_id
-- SQL Editor → New query → 붙여넣기 → Run

create table if not exists memo_categories (
  id text primary key,
  name text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table memo_categories is '포스트잇 메모 카테고리(유튜브·라이프 등). 기기/브라우저 동기화';

create index if not exists idx_memo_categories_sort on memo_categories (sort_order);

alter table memo_categories enable row level security;
drop policy if exists "allow all memo_categories" on memo_categories;
create policy "allow all memo_categories" on memo_categories for all using (true) with check (true);

alter table memos add column if not exists category_id text;
comment on column memos.category_id is 'memo_categories.id. null이면 앱에서 기타로 보정';

create index if not exists idx_memos_category_id on memos (category_id) where deleted_at is null;
