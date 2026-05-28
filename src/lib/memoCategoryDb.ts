/**
 * 포스트잇 메모 카테고리 (유튜브 / 라이프 / 기타 등)
 * Supabase 연결 시 memo_categories 테이블, 없으면 localStorage
 */

import { supabase } from "./supabase";

export type MemoCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

/** 휴지통 보기(카테고리 칩) — DB에 저장하지 않음 */
export const MEMO_CATEGORY_TRASH_ID = "__trash__";

/** @deprecated 예전 「전체」 선택값 — 로드 시 첫 카테고리로 치환 */
export const MEMO_CATEGORY_ALL_ID = "__all__";

const CATEGORIES_KEY = "my-lifestyle-memo-categories";
const SELECTED_CATEGORY_KEY = "memo-selected-category-id";

export const DEFAULT_MEMO_CATEGORIES: MemoCategory[] = [
  { id: "memo-cat-youtube", name: "유튜브", sortOrder: 0 },
  { id: "memo-cat-life", name: "라이프", sortOrder: 1 },
  { id: "memo-cat-other", name: "기타", sortOrder: 2 },
];

export function getDefaultMemoCategoryId(): string {
  return DEFAULT_MEMO_CATEGORIES[2]!.id;
}

export function sortMemoCategories(list: MemoCategory[]): MemoCategory[] {
  return [...list].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko")
  );
}

/** 선택한 카테고리를 맨 앞(sortOrder 0)으로 두고 나머지 순서 유지 */
export function pinMemoCategoryFirst(list: MemoCategory[], selectedId: string): MemoCategory[] {
  const sorted = sortMemoCategories(list);
  const idx = sorted.findIndex((c) => c.id === selectedId);
  if (idx <= 0) return sorted;
  const selected = sorted[idx]!;
  const reordered = [selected, ...sorted.slice(0, idx), ...sorted.slice(idx + 1)];
  return reordered.map((c, i) => ({ ...c, sortOrder: i }));
}

function loadCategoriesFromLocal(): MemoCategory[] {
  if (typeof window === "undefined") return [...DEFAULT_MEMO_CATEGORIES];
  try {
    const raw = window.localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return [...DEFAULT_MEMO_CATEGORIES];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return [...DEFAULT_MEMO_CATEGORIES];
    return arr
      .filter((x): x is MemoCategory => x != null && typeof x === "object" && typeof (x as MemoCategory).id === "string")
      .map((x) => ({
        id: x.id,
        name: String(x.name ?? ""),
        sortOrder: typeof x.sortOrder === "number" ? x.sortOrder : 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [...DEFAULT_MEMO_CATEGORIES];
  }
}

function saveCategoriesToLocal(list: MemoCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export async function loadMemoCategories(): Promise<MemoCategory[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("memo_categories")
        .select("id,name,sort_order")
        .order("sort_order", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        const list = data.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ""),
          sortOrder: Number(row.sort_order ?? 0),
        }));
        saveCategoriesToLocal(list);
        return list;
      }
      const local = loadCategoriesFromLocal();
      if (local.length > 0) {
        await saveMemoCategories(local);
        return local;
      }
    } catch {
      /* fall through */
    }
  }
  return loadCategoriesFromLocal();
}

export async function saveMemoCategories(categories: MemoCategory[]): Promise<void> {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  saveCategoriesToLocal(sorted);
  if (!supabase) return;
  try {
    const rows = sorted.map((c) => ({
      id: c.id,
      name: c.name,
      sort_order: c.sortOrder,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("memo_categories").upsert(rows, { onConflict: "id" });
    if (error) console.error("[memoCategoryDb] saveMemoCategories", error);
  } catch {
    /* ignore */
  }
}

export function generateMemoCategoryId(): string {
  return `memo-cat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getSelectedMemoCategoryId(): string {
  if (typeof window === "undefined") return getDefaultMemoCategoryId();
  try {
    const id = window.localStorage.getItem(SELECTED_CATEGORY_KEY);
    if (!id || id === MEMO_CATEGORY_ALL_ID) return getDefaultMemoCategoryId();
    return id;
  } catch {
    return getDefaultMemoCategoryId();
  }
}

/** 저장된 선택 id가 유효한지 보정 (없는 카테고리·옛 「전체」) */
export function resolveSelectedMemoCategoryId(
  storedId: string,
  categoryIds: string[]
): string {
  if (storedId === MEMO_CATEGORY_TRASH_ID) return MEMO_CATEGORY_TRASH_ID;
  if (storedId === MEMO_CATEGORY_ALL_ID || !categoryIds.includes(storedId)) {
    return categoryIds[0] ?? getDefaultMemoCategoryId();
  }
  return storedId;
}

export function setSelectedMemoCategoryId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_CATEGORY_KEY, id);
  } catch {
    /* ignore */
  }
}
