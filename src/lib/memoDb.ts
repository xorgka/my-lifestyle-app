/**
 * 메모: 포스트잇 형태.
 * Supabase 연결 시 DB 사용(기기/모바일 동기화), 없으면 localStorage
 */

import { supabase } from "./supabase";

const MEMO_KEY = "my-lifestyle-memos";

export type MemoColorId =
  | "black"
  | "wine"
  | "purple"
  | "orange"
  | "warmgray";

export type Memo = {
  id: string;
  content: string;
  createdAt: string; // ISO
  color: MemoColorId;
  pinned?: boolean;
  /** 고정(별) 누른 시각(ISO). 홈 노출 순서에 사용 */
  pinnedAt?: string;
  title?: string;
  /** 휴지통 이동 시각(ISO). 있으면 휴지통에 있음 */
  deletedAt?: string;
  /** 절대 위치(px). 없으면 그리드 기본값 적용 */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** 헤더만 보이도록 접힌 상태 (더블클릭으로 토글) */
  collapsed?: boolean;
};

export const MEMO_DEFAULT_WIDTH = 320;
export const MEMO_DEFAULT_HEIGHT = 320;
export const MEMO_MIN_WIDTH = 220;
export const MEMO_MIN_HEIGHT = 220;

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const MEMO_COLOR_IDS: MemoColorId[] = ["black", "wine", "purple", "orange", "warmgray"];
function toMemoColorId(v: unknown): MemoColorId {
  if (typeof v === "string" && MEMO_COLOR_IDS.includes(v as MemoColorId)) return v as MemoColorId;
  return "black";
}

function rowToMemo(row: Record<string, unknown>): Memo {
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    color: toMemoColorId(row.color),
    pinned: Boolean(row.pinned),
    pinnedAt: row.pinned_at ? new Date(row.pinned_at as string).toISOString() : undefined,
    title: row.title != null ? String(row.title) : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).toISOString() : undefined,
    x: row.x != null ? Number(row.x) : undefined,
    y: row.y != null ? Number(row.y) : undefined,
    width: row.width != null ? Number(row.width) : undefined,
    height: row.height != null ? Number(row.height) : undefined,
    collapsed: row.collapsed === true,
  };
}

function memoToRow(m: Memo): Record<string, unknown> {
  return {
    id: m.id,
    content: m.content,
    created_at: m.createdAt,
    color: m.color,
    pinned: m.pinned ?? false,
    pinned_at: m.pinnedAt ?? null,
    title: m.title ?? null,
    deleted_at: m.deletedAt ?? null,
    x: m.x ?? null,
    y: m.y ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    collapsed: m.collapsed ?? false,
  };
}

function loadAllFromStorage(): Memo[] {
  const data = loadJson<Memo[]>(MEMO_KEY, []);
  return Array.isArray(data) ? data : [];
}

function mergeMemosPreferLocal(local: Memo[], remote: Memo[]): Memo[] {
  const map = new Map<string, Memo>();
  for (const m of remote) map.set(m.id, m);
  // 같은 id가 있으면 로컬(현재 기기 최신 편집)을 우선
  for (const m of local) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/** 전체 메모 로드 (Supabase 또는 localStorage). 휴지통 포함 */
export async function loadAllMemos(): Promise<Memo[]> {
  const fromStorage = loadAllFromStorage();
  if (supabase) {
    const { data, error } = await supabase
      .from("memos")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[memoDb] loadAllMemos", error);
      return fromStorage;
    }
    const fromDb = (data ?? []).map((row) => rowToMemo(row));
    if (fromDb.length === 0 && fromStorage.length > 0) {
      await saveMemos(fromStorage);
      return fromStorage;
    }
    const merged = mergeMemosPreferLocal(fromStorage, fromDb);
    // 로컬 기준으로 병합 결과가 달라지면 로컬도 최신으로 맞춤
    saveJson(MEMO_KEY, merged);
    return merged;
  }
  return fromStorage;
}

/** 일반 메모만 (휴지통 제외) */
export async function loadMemos(): Promise<Memo[]> {
  const all = await loadAllMemos();
  return all.filter((m) => !m.deletedAt);
}

/** 휴지통에 있는 메모만 */
export async function loadTrashMemos(): Promise<Memo[]> {
  const all = await loadAllMemos();
  return all.filter((m) => !!m.deletedAt);
}

/**
 * 메모 전체 저장 (Supabase 또는 localStorage). Supabase 시 기존 중 목록에 없는 행은 삭제.
 * @returns DB에 반영 성공 여부. Supabase 미사용 시 true. 실패 시에도 로컬은 이미 저장됨.
 */
export async function saveMemos(memos: Memo[]): Promise<boolean> {
  // DB 실패 시에도 새로고침 복구 가능하도록 로컬을 항상 먼저 갱신
  saveJson(MEMO_KEY, memos);
  if (supabase) {
    const ourIds = new Set(memos.map((m) => m.id));
    const { data: existing } = await supabase.from("memos").select("id");
    const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !ourIds.has(id));
    // 안전장치: 빈 입력으로 기존 DB 메모 전체 삭제되는 상황 방지
    if (memos.length === 0 && (existing?.length ?? 0) > 0) {
      console.warn("[memoDb] saveMemos skip destructive delete (empty input)");
      return true;
    }
    if (toDelete.length > 0) {
      const { error: delError } = await supabase.from("memos").delete().in("id", toDelete);
      if (delError) {
        console.error("[memoDb] saveMemos delete", delError);
        return false;
      }
    }
    const rows = memos.map((m) => memoToRow(m));
    const { error } = await supabase.from("memos").upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("[memoDb] saveMemos", error);
      return false;
    }
    return true;
  }
  return true;
}

/** 활성 메모만 넘기고 저장 시 휴지통 항목은 그대로 유지 (추가/수정/드래그/리사이즈 시 사용) */
export async function saveMemosKeepingTrash(activeMemos: Memo[]): Promise<boolean> {
  const all = await loadAllMemos();
  const trashed = all.filter((m) => m.deletedAt);
  return saveMemos([...activeMemos, ...trashed]);
}

/** 메모 목록만 갱신(휴지통 항목은 유지). 위치 등 기본값 보정 시 사용 */
export async function saveMemosOnlyUpdate(updatedMemos: Memo[]): Promise<boolean> {
  const all = await loadAllMemos();
  const updatedIds = new Set(updatedMemos.map((m) => m.id));
  const rest = all.filter((m) => !updatedIds.has(m.id));
  return saveMemos([...updatedMemos, ...rest]);
}

/** 메모를 휴지통으로 이동 */
export async function moveMemoToTrash(id: string): Promise<void> {
  const all = await loadAllMemos();
  const next = all.map((m) =>
    m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m
  );
  await saveMemos(next);
}

/** 휴지통에서 복원 */
export async function restoreMemo(id: string): Promise<void> {
  const all = await loadAllMemos();
  const next = all.map((m) => (m.id === id ? { ...m, deletedAt: undefined } : m));
  await saveMemos(next);
}

/** 휴지통에서 완전 삭제 */
export async function permanentDeleteMemo(id: string): Promise<void> {
  const all = await loadAllMemos();
  await saveMemos(all.filter((m) => m.id !== id));
}

export function createMemo(color: MemoColorId = "black"): Memo {
  return {
    id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    content: "",
    createdAt: new Date().toISOString(),
    color,
    pinned: false,
    x: 20,
    y: 20,
    width: MEMO_DEFAULT_WIDTH,
    height: MEMO_DEFAULT_HEIGHT,
  };
}

/** 헤더/배경 색상 (hex). headerFg 있으면 어두운 헤더용 밝은 글자색 */
export const MEMO_COLORS: Record<
  MemoColorId,
  {
    headerBg: string;
    bodyBg: string;
    border: string;
    label: string;
    headerFg?: string;
  }
> = {
  black: {
    headerBg: "#222222",
    bodyBg: "#f3f4f6",
    border: "#333333",
    label: "블랙",
    headerFg: "#f3f4f6",
  },
  wine: {
    headerBg: "#7f1d1d",
    bodyBg: "#fef2f2",
    border: "#991b1b",
    label: "와인",
    headerFg: "#fef2f2",
  },
  purple: {
    headerBg: "#581c87",
    bodyBg: "#faf5ff",
    border: "#6b21a8",
    label: "퍼플",
    headerFg: "#f5f3ff",
  },
  orange: {
    headerBg: "#c2410c",
    bodyBg: "#fff7ed",
    border: "#ea580c",
    label: "주황",
    headerFg: "#ffffff",
  },
  warmgray: {
    headerBg: "#57534e",
    bodyBg: "#fafaf9",
    border: "#78716c",
    label: "웜 그레이",
    headerFg: "#ffffff",
  },
};
