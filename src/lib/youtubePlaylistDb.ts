/**
 * 유튜브 재생목록: 노래/영상 링크 + 태그(가수, 분위기, 장르).
 * Supabase 연결 시 DB, 없으면 localStorage.
 */

import { supabase } from "./supabase";

export type PlaylistTags = {
  가수?: string;
  노래분위기?: string;
  장르?: string;
};

export type PlaylistEntry = {
  id: string;
  url: string;
  title: string;
  /** 재생 순서 (작을수록 먼저) */
  sortOrder: number;
  /** 재생 시작 초 (optional, URL의 t= 파라미터) */
  startSeconds?: number;
  tags: PlaylistTags;
  /** 즐겨찾기 여부 */
  favorite?: boolean;
};

const STORAGE_KEY = "my-lifestyle-youtube-playlist";

/** YouTube URL에서 videoId와 startSeconds 추출 */
export function parseYoutubeUrl(url: string): { videoId: string | null; startSeconds?: number } {
  if (!url || typeof url !== "string") return { videoId: null };
  try {
    const u = new URL(url.trim());
    if (!/youtube\.com|youtu\.be/.test(u.hostname)) return { videoId: null };
    let videoId: string | null = null;
    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1).split("?")[0] || null;
    } else {
      videoId = u.searchParams.get("v");
    }
    const t = u.searchParams.get("t");
    const startSeconds = t != null ? parseInt(t, 10) : undefined;
    if (startSeconds !== undefined && (Number.isNaN(startSeconds) || startSeconds < 0))
      return { videoId, startSeconds: undefined };
    return { videoId, startSeconds: startSeconds >= 0 ? startSeconds : undefined };
  } catch {
    return { videoId: null };
  }
}

/** watch URL 생성 (모바일 외부 재생용) */
export function youtubeWatchUrl(videoId: string, startSeconds?: number): string {
  const u = new URL(`https://www.youtube.com/watch`);
  u.searchParams.set("v", videoId);
  if (startSeconds != null && startSeconds > 0) u.searchParams.set("t", String(startSeconds));
  return u.toString();
}

function loadFromStorage(): PlaylistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlaylistEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e) => ({
        id: String(e.id),
        url: e.url ?? "",
        title: e.title ?? "",
        sortOrder: typeof e.sortOrder === "number" ? e.sortOrder : 0,
        startSeconds: typeof e.startSeconds === "number" ? e.startSeconds : undefined,
        tags: e.tags && typeof e.tags === "object" ? e.tags : {},
        favorite: e.favorite === true,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

function saveToStorage(entries: PlaylistEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

const DEFAULT_ENTRIES: PlaylistEntry[] = [
  {
    id: "default-1",
    url: "https://www.youtube.com/watch?v=E1rqAcMr-ps&list=RDE1rqAcMr-ps&start_radio=1",
    title: "재생목록 1",
    sortOrder: 0,
    startSeconds: undefined,
    tags: {},
  },
  {
    id: "default-2",
    url: "https://www.youtube.com/watch?v=k7xeWnke9kU&t=6928s",
    title: "재생목록 2",
    sortOrder: 1,
    startSeconds: 6928,
    tags: {},
  },
];

function rowToEntry(row: {
  id: string;
  url: string | null;
  title: string | null;
  sort_order: number;
  start_seconds: number | null;
  tags: PlaylistTags | null;
  favorite?: boolean | null;
}): PlaylistEntry {
  return {
    id: row.id,
    url: row.url ?? "",
    title: row.title ?? "",
    sortOrder: row.sort_order ?? 0,
    startSeconds: row.start_seconds != null ? row.start_seconds : undefined,
    tags: row.tags && typeof row.tags === "object" ? row.tags : {},
    favorite: row.favorite === true,
  };
}

export async function loadPlaylistEntries(): Promise<PlaylistEntry[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("youtube_playlist")
      .select("id, url, title, sort_order, start_seconds, tags, favorite")
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("[youtubePlaylist] load", error);
      return loadFromStorage();
    }
    const fromDb = (data ?? []).map(rowToEntry);
    if (fromDb.length > 0) return fromDb;
    const fromStorage = loadFromStorage();
    if (fromStorage.length > 0) {
      for (const e of fromStorage) {
        await savePlaylistEntry(e);
      }
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      return loadPlaylistEntries();
    }
    // DB·로컬 둘 다 비어 있으면 예시 2개 넣어서 재생 바가 보이게
    for (const e of DEFAULT_ENTRIES) {
      await savePlaylistEntry(e);
    }
    const after = await loadPlaylistEntries();
    if (after.length > 0) return after;
    // 테이블 없음 등으로 DB에 안 들어갔으면 로컬에 넣고 반환
    saveToStorage([...DEFAULT_ENTRIES]);
    return DEFAULT_ENTRIES;
  }
  const fromStorage = loadFromStorage();
  if (fromStorage.length === 0) {
    saveToStorage([...DEFAULT_ENTRIES]);
    return DEFAULT_ENTRIES;
  }
  return fromStorage;
}

export async function savePlaylistEntry(entry: PlaylistEntry): Promise<void> {
  const mergeIntoLocal = () => {
    const list = loadFromStorage();
    const idx = list.findIndex((e) => e.id === entry.id);
    const next = [...list];
    if (idx >= 0) next[idx] = entry;
    else next.push(entry);
    next.sort((a, b) => a.sortOrder - b.sortOrder);
    saveToStorage(next);
  };

  if (supabase) {
    const { error } = await supabase.from("youtube_playlist").upsert(
      {
        id: entry.id,
        url: entry.url,
        title: entry.title,
        sort_order: entry.sortOrder,
        start_seconds: entry.startSeconds ?? null,
        tags: entry.tags ?? {},
        favorite: entry.favorite === true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.warn("[youtubePlaylist] save (Supabase 실패)", entry.id, error.message);
      mergeIntoLocal();
      throw new Error(`저장 실패: ${error.message}`);
    }
    return;
  }
  mergeIntoLocal();
}

export async function savePlaylistEntries(entries: PlaylistEntry[]): Promise<void> {
  if (supabase) {
    for (const e of entries) {
      await savePlaylistEntry(e);
    }
    return;
  }
  saveToStorage(entries);
}

export async function deletePlaylistEntry(id: string): Promise<void> {
  if (supabase) {
    await supabase.from("youtube_playlist").delete().eq("id", id);
    return;
  }
  const list = loadFromStorage().filter((e) => e.id !== id);
  saveToStorage(list);
}

export async function reorderPlaylistEntries(orderedIds: string[]): Promise<void> {
  const list = await loadPlaylistEntries();
  const byId = new Map(list.map((e) => [e.id, e]));
  const next: PlaylistEntry[] = orderedIds
    .map((id, i) => {
      const e = byId.get(id);
      return e ? { ...e, sortOrder: i } : null;
    })
    .filter((e): e is PlaylistEntry => e != null);
  await savePlaylistEntries(next);
}
