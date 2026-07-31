"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HOME_VIDEO_CATEGORIES,
  deleteStorageVideo,
  listStorageVideos,
  uploadStorageVideo,
  type HomeVideoCategoryId,
  type StorageVideo,
} from "@/lib/homeVideos";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** 설정 → 홈 화면 탭: Supabase Storage 영상 업로드/삭제 관리 */
export function HomeVideoStorageManager() {
  const [categoryId, setCategoryId] = useState<HomeVideoCategoryId>("insight");
  const [videos, setVideos] = useState<StorageVideo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: HomeVideoCategoryId) => {
    setVideos(null);
    setVideos(await listStorageVideos(id));
  }, []);

  useEffect(() => {
    void refresh(categoryId);
  }, [categoryId, refresh]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || busy) return;
    setError(null);
    const files = Array.from(fileList);
    for (let i = 0; i < files.length; i++) {
      setBusy(`업로드 중… (${i + 1}/${files.length}) ${files[i].name}`);
      const res = await uploadStorageVideo(categoryId, files[i]);
      if (!res.ok) {
        setError(
          res.message.toLowerCase().includes("bucket not found")
            ? "버킷이 아직 없어요. supabase/migration-home-videos-storage.sql 내용을 Supabase 대시보드 → SQL Editor에서 실행해 주세요."
            : `업로드 실패: ${res.message}`
        );
        break;
      }
    }
    setBusy(null);
    await refresh(categoryId);
  };

  const handleDelete = async (v: StorageVideo) => {
    if (busy) return;
    if (!window.confirm(`'${v.name}' 영상을 삭제할까요?`)) return;
    setError(null);
    const res = await deleteStorageVideo(v.path);
    if (!res.ok) setError(`삭제 실패: ${res.message ?? "알 수 없는 오류"}`);
    await refresh(categoryId);
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
      <div>
        <p className="text-sm font-semibold text-neutral-700">영상 관리 (Supabase Storage)</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          업로드한 영상은 배포 사이트·다른 기기에서도 보여요. 로컬 실행 중이면 public/videos 폴더의 영상도 함께 나와요.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {HOME_VIDEO_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              categoryId === c.id ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label
        className={`inline-block cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {busy ?? "+ 영상 업로드"}
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.m4v,.ogg"
          multiple
          className="hidden"
          disabled={busy !== null}
          onChange={(e) => {
            void handleUpload(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {videos === null ? (
        <p className="text-xs text-neutral-400">목록 불러오는 중…</p>
      ) : videos.length === 0 ? (
        <p className="text-xs text-neutral-400">아직 업로드한 영상이 없어요.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {videos.map((v) => (
            <li
              key={v.path}
              className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-white px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-neutral-700" title={v.name}>
                {v.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">{formatSize(v.size)}</span>
              <button
                type="button"
                onClick={() => void handleDelete(v)}
                className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
