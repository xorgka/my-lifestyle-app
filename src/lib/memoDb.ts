/**
 * 메모: 포스트잇 형태, localStorage 저장
 * 색상은 인라인 스타일(hex)로 적용해 모든 테마가 동일하게 보이도록 함.
 */

const MEMO_KEY = "my-lifestyle-memos";

export type MemoColorId =
  | "black"
  | "wine"
  | "purple";

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

function loadAllMemos(): Memo[] {
  const data = loadJson<Memo[]>(MEMO_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function loadMemos(): Memo[] {
  return loadAllMemos().filter((m) => !m.deletedAt);
}

/** 휴지통에 있는 메모만 */
export function loadTrashMemos(): Memo[] {
  return loadAllMemos().filter((m) => !!m.deletedAt);
}

export function saveMemos(memos: Memo[]): void {
  saveJson(MEMO_KEY, memos);
}

/** 메모 목록만 갱신(휴지통 항목은 유지). 위치 등 기본값 보정 시 사용 */
export function saveMemosOnlyUpdate(updatedMemos: Memo[]): void {
  const all = loadAllMemos();
  const updatedIds = new Set(updatedMemos.map((m) => m.id));
  const rest = all.filter((m) => !updatedIds.has(m.id));
  saveJson(MEMO_KEY, [...updatedMemos, ...rest]);
}

/** 메모를 휴지통으로 이동 */
export function moveMemoToTrash(id: string): void {
  const all = loadAllMemos();
  const next = all.map((m) =>
    m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m
  );
  saveMemos(next);
}

/** 휴지통에서 복원 */
export function restoreMemo(id: string): void {
  const all = loadAllMemos();
  const next = all.map((m) => (m.id === id ? { ...m, deletedAt: undefined } : m));
  saveMemos(next);
}

/** 휴지통에서 완전 삭제 */
export function permanentDeleteMemo(id: string): void {
  const all = loadAllMemos();
  saveMemos(all.filter((m) => m.id !== id));
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
};
