/**
 * 노트(에버노트 스타일): 노트북 + 노트.
 * Supabase 연결 시 DB 사용(기기 동기화), 없으면 localStorage.
 */

import { supabase } from "./supabase";

const NOTEBOOKS_KEY = "my-lifestyle-note-notebooks";
const NOTES_KEY = "my-lifestyle-notes";

export type Notebook = {
  id: string;
  title: string;
  /** 접힌 상태 */
  collapsed: boolean;
  /** 정렬 순서 (작을수록 위) */
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  notebookId: string | null;
  title: string;
  /** HTML 콘텐츠 */
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

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

// --- localStorage fallback ---

export function loadNotebooksFromStorage(): Notebook[] {
  const raw = loadJson<Notebook[]>(NOTEBOOKS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function loadNotesFromStorage(): Note[] {
  const raw = loadJson<Note[]>(NOTES_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function saveNotebooksToStorage(list: Notebook[]): void {
  saveJson(NOTEBOOKS_KEY, list);
}

function saveNotesToStorage(list: Note[]): void {
  saveJson(NOTES_KEY, list);
}

// --- Supabase ---

function notebookToRow(n: Notebook): Record<string, unknown> {
  return {
    id: n.id,
    title: n.title,
    collapsed: n.collapsed ?? false,
    sort_order: n.order ?? 0,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

function rowToNotebook(row: Record<string, unknown>): Notebook {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    collapsed: Boolean(row.collapsed),
    order: Number(row.sort_order ?? row.order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function noteToRow(n: Note): Record<string, unknown> {
  return {
    id: n.id,
    notebook_id: n.notebookId ?? null,
    title: n.title ?? "",
    content: n.content ?? "",
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    deleted_at: n.deletedAt ?? null,
  };
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    notebookId: row.notebook_id != null ? String(row.notebook_id) : null,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
  };
}

// --- Notebooks API ---

export async function loadNotebooks(): Promise<Notebook[]> {
  if (supabase) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from("note_notebooks")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!error && Array.isArray(data)) {
        const fromDb = data.map((r) => rowToNotebook(r));
        if (fromDb.length === 0) {
          const fromStorage = loadNotebooksFromStorage();
          if (fromStorage.length > 0) {
            await saveNotebooks(fromStorage);
            return fromStorage;
          }
        }
        return fromDb;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  return loadNotebooksFromStorage();
}

export async function saveNotebooks(notebooks: Notebook[]): Promise<void> {
  const now = new Date().toISOString();
  const withTimestamps = notebooks.map((n) => ({
    ...n,
    updatedAt: now,
  }));
  saveNotebooksToStorage(withTimestamps);
  if (supabase) {
    try {
      const rows = withTimestamps.map((n) => notebookToRow(n));
      await supabase.from("note_notebooks").upsert(rows, { onConflict: "id" });
    } catch {}
  }
}

export function createNotebook(title: string = ""): Notebook {
  const now = new Date().toISOString();
  return {
    id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    collapsed: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Notes API (활성 + 휴지통) ---

export async function loadAllNotes(): Promise<Note[]> {
  if (supabase) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from("note_notes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        const fromDb = data.map((r) => rowToNote(r));
        if (fromDb.length === 0) {
          const fromStorage = loadNotesFromStorage();
          if (fromStorage.length > 0) {
            await saveNotes(fromStorage);
            return fromStorage;
          }
        }
        return fromDb;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  return loadNotesFromStorage();
}

/** 휴지통 제외 */
export async function loadNotes(): Promise<Note[]> {
  const all = await loadAllNotes();
  return all.filter((n) => !n.deletedAt);
}

/** 휴지통만 */
export async function loadTrashNotes(): Promise<Note[]> {
  const all = await loadAllNotes();
  return all.filter((n) => !!n.deletedAt);
}

export async function saveNotes(notes: Note[]): Promise<void> {
  saveNotesToStorage(notes);
  if (supabase) {
    try {
      const rows = notes.map((n) => noteToRow(n));
      await supabase.from("note_notes").upsert(rows, { onConflict: "id" });
    } catch {}
  }
}

/** 활성 노트만 저장할 때 휴지통 노트 유지 */
export async function saveNotesKeepingTrash(activeNotes: Note[]): Promise<void> {
  const all = await loadAllNotes();
  const trashed = all.filter((n) => n.deletedAt);
  const byId = new Map(activeNotes.map((n) => [n.id, n]));
  trashed.forEach((n) => byId.set(n.id, n));
  await saveNotes(Array.from(byId.values()));
}

export function createNote(notebookId: string | null = null): Note {
  const now = new Date().toISOString();
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    notebookId,
    title: "제목 없음",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
}

export async function moveNoteToTrash(noteId: string): Promise<void> {
  const all = await loadAllNotes();
  const now = new Date().toISOString();
  const next = all.map((n) =>
    n.id === noteId ? { ...n, deletedAt: now, updatedAt: now } : n
  );
  await saveNotes(next);
}

export async function restoreNote(noteId: string): Promise<void> {
  const all = await loadAllNotes();
  const next = all.map((n) =>
    n.id === noteId ? { ...n, deletedAt: undefined, updatedAt: new Date().toISOString() } : n
  );
  await saveNotes(next);
}

export async function permanentDeleteNote(noteId: string): Promise<void> {
  const all = await loadAllNotes();
  await saveNotes(all.filter((n) => n.id !== noteId));
}

const NOTE_RESET_KEY = "my-lifestyle-note-one-notebook-reset";

/** 로컬 노트/노트북/휴지통 전부 삭제 후 노트북 1개만 새로 만들어 초기화 */
export function resetNoteLocalData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NOTEBOOKS_KEY);
    window.localStorage.removeItem(NOTES_KEY);
    window.localStorage.removeItem(NOTE_RESET_KEY);
    const one = createNotebook("");
    saveNotebooksToStorage([one]);
  } catch {}
}
