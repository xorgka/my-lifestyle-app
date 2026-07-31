-- ============================================================
-- 홈 영상 템플릿용 Storage 버킷 (New query 에서 실행)
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run
-- ============================================================

-- 공개 버킷: 영상은 공개 URL로 재생 (CDN 캐시 → 전송량 절약)
-- 파일 1개 최대 50MB (무료 플랜 한도와 동일)
insert into storage.buckets (id, name, public, file_size_limit)
values ('home-videos', 'home-videos', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

-- 이 버킷에 한해 목록/업로드/수정/삭제 허용 (다른 버킷에는 영향 없음)
drop policy if exists "allow all home-videos select" on storage.objects;
drop policy if exists "allow all home-videos insert" on storage.objects;
drop policy if exists "allow all home-videos update" on storage.objects;
drop policy if exists "allow all home-videos delete" on storage.objects;

create policy "allow all home-videos select" on storage.objects
  for select using (bucket_id = 'home-videos');
create policy "allow all home-videos insert" on storage.objects
  for insert with check (bucket_id = 'home-videos');
create policy "allow all home-videos update" on storage.objects
  for update using (bucket_id = 'home-videos') with check (bucket_id = 'home-videos');
create policy "allow all home-videos delete" on storage.objects
  for delete using (bucket_id = 'home-videos');
