/**
 * 프로젝트 의뢰 유입 옵션 (크몽/기존고객/스레드 등)
 * Supabase 연결 시 production_request_sources 테이블, 없으면 localStorage
 */

import { supabase } from "./supabase";

export type SourceOption = {
  id: string;
  name: string;
  sortOrder: number;
};

const SOURCES_KEY = "my-lifestyle-production-request-sources";

export const DEFAULT_SOURCE_OPTIONS: SourceOption[] = [
  { id: "prs-kmong", name: "크몽", sortOrder: 0 },
  { id: "prs-existing", name: "기존고객", sortOrder: 1 },
  { id: "prs-threads", name: "스레드", sortOrder: 2 },
  { id: "prs-instagram", name: "인스타", sortOrder: 3 },
  { id: "prs-youtube", name: "유튜브", sortOrder: 4 },
  { id: "prs-tiktok", name: "틱톡", sortOrder: 5 },
  { id: "prs-clip", name: "클립", sortOrder: 6 },
  { id: "prs-referral", name: "소개", sortOrder: 7 },
];

export function sortSourceOptions(list: SourceOption[]): SourceOption[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));
}

function loadSourcesFromLocal(): SourceOption[] {
  if (typeof window === "undefined") return [...DEFAULT_SOURCE_OPTIONS];
  try {
    const raw = window.localStorage.getItem(SOURCES_KEY);
    if (!raw) return [...DEFAULT_SOURCE_OPTIONS];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return [...DEFAULT_SOURCE_OPTIONS];
    return arr
      .filter((x): x is SourceOption => x != null && typeof x === "object" && typeof (x as SourceOption).id === "string")
      .map((x) => ({
        id: x.id,
        name: String(x.name ?? ""),
        sortOrder: typeof x.sortOrder === "number" ? x.sortOrder : 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [...DEFAULT_SOURCE_OPTIONS];
  }
}

function saveSourcesToLocal(list: SourceOption[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOURCES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export async function loadSourceOptions(): Promise<SourceOption[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("production_request_sources")
        .select("id,name,sort_order")
        .order("sort_order", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        const list = data.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ""),
          sortOrder: Number(row.sort_order ?? 0),
        }));
        saveSourcesToLocal(list);
        return list;
      }
      const local = loadSourcesFromLocal();
      if (local.length > 0) {
        await saveSourceOptions(local);
        return local;
      }
    } catch {
      /* fall through */
    }
  }
  return loadSourcesFromLocal();
}

/** 목록 전체 저장. 테이블에 있지만 목록에 없는 행은 삭제로 반영 */
export async function saveSourceOptions(options: SourceOption[]): Promise<void> {
  const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder);
  saveSourcesToLocal(sorted);
  if (!supabase) return;
  try {
    const { data } = await supabase.from("production_request_sources").select("id");
    const keep = new Set(sorted.map((s) => s.id));
    const removed = (data ?? []).map((r) => String(r.id)).filter((id) => !keep.has(id));
    if (removed.length > 0) {
      await supabase.from("production_request_sources").delete().in("id", removed);
    }
    const rows = sorted.map((s) => ({
      id: s.id,
      name: s.name,
      sort_order: s.sortOrder,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("production_request_sources").upsert(rows, { onConflict: "id" });
    if (error) console.error("[productionRequestSourcesDb] saveSourceOptions", error);
  } catch {
    /* ignore */
  }
}

export function generateSourceOptionId(): string {
  return `prs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
