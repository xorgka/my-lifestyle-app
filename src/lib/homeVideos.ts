/**
 * 홈 영상 템플릿: 카테고리 정의 + Supabase Storage 목록/업로드/삭제
 * - 영상 카드는 로컬 폴더(public/videos, 로컬 실행 시)와 Storage를 합쳐서 재생
 * - 버킷이 없으면 supabase/migration-home-videos-storage.sql 실행 필요
 */

import { supabase } from "./supabase";

export const HOME_VIDEO_BUCKET = "home-videos";

export const HOME_VIDEO_CATEGORIES = [
  { id: "insight", label: "인사이트", folder: "인사이트" },
  { id: "workout", label: "운동", folder: "운동" },
  { id: "etc", label: "기타", folder: "기타" },
] as const;

export type HomeVideoCategoryId = (typeof HOME_VIDEO_CATEGORIES)[number]["id"];

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];

export function isVideoFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type StorageVideo = { name: string; path: string; url: string; size: number };

export async function listStorageVideos(categoryId: HomeVideoCategoryId): Promise<StorageVideo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.storage
    .from(HOME_VIDEO_BUCKET)
    .list(categoryId, { limit: 500, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return [];
  return data
    .filter((f) => isVideoFileName(f.name))
    .map((f) => {
      const path = `${categoryId}/${f.name}`;
      const { data: pub } = supabase!.storage.from(HOME_VIDEO_BUCKET).getPublicUrl(path);
      const size = (f.metadata as { size?: number } | null)?.size ?? 0;
      return { name: f.name, path, url: pub.publicUrl, size };
    });
}

/** Storage 키에 못 쓰는 문자(한글·공백 등)를 _로 치환 */
export function sanitizeVideoFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const safe = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (safe || `video_${Date.now()}`) + ext;
}

export async function uploadStorageVideo(
  categoryId: HomeVideoCategoryId,
  file: File
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase가 설정되지 않았어요." };
  if (!isVideoFileName(file.name)) return { ok: false, message: `지원하지 않는 형식: ${file.name}` };
  const path = `${categoryId}/${sanitizeVideoFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(HOME_VIDEO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteStorageVideo(path: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: "Supabase가 설정되지 않았어요." };
  const { error } = await supabase.storage.from(HOME_VIDEO_BUCKET).remove([path]);
  return error ? { ok: false, message: error.message } : { ok: true };
}
