/**
 * 타임테이블 항목 ↔ 루틴 항목 연동.
 * Supabase 연결 시 기기·브라우저 동기화, 없으면 localStorage.
 */

import { supabase } from "./supabase";

const STORAGE_KEY = "timetable-routine-links";
const TABLE_NAME = "timetable_routine_links";

function loadFromStorage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, number> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      const num = Number(v);
      if (!Number.isNaN(num)) out[k] = num;
    });
    return out;
  } catch {
    return {};
  }
}

function saveToStorage(links: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {}
}

async function loadFromSupabase(): Promise<Record<string, number>> {
  if (!supabase) return loadFromStorage();
  const { data, error } = await supabase.from(TABLE_NAME).select("timetable_item_id, routine_item_id");
  if (error) {
    console.warn("[timetableRoutineLinks] loadFromSupabase", error.message);
    return loadFromStorage();
  }
  const out: Record<string, number> = {};
  (data ?? []).forEach((row: { timetable_item_id: string; routine_item_id: number }) => {
    const rid = Number(row.routine_item_id);
    if (!Number.isNaN(rid)) out[row.timetable_item_id] = rid;
  });
  return out;
}

async function saveToSupabase(links: Record<string, number>): Promise<void> {
  if (!supabase) return;
  try {
    const rows = Object.entries(links).map(([timetable_item_id, routine_item_id]) => ({
      timetable_item_id,
      routine_item_id,
    }));
    const keys = Object.keys(links);
    const { data: existing } = await supabase.from(TABLE_NAME).select("timetable_item_id");
    const toDelete = (existing ?? []).map((r: { timetable_item_id: string }) => r.timetable_item_id).filter((id) => !keys.includes(id));
    if (toDelete.length > 0) {
      await supabase.from(TABLE_NAME).delete().in("timetable_item_id", toDelete);
    }
    if (rows.length > 0) {
      await supabase.from(TABLE_NAME).upsert(rows, { onConflict: "timetable_item_id" });
    }
  } catch (e) {
    console.warn("[timetableRoutineLinks] saveToSupabase", e);
  }
}

/** 전체 연동 데이터 로드. Supabase 우선, 없으면 localStorage. 한 번 로드 후 페이지 state로 보관해 두고 사용 */
export async function loadTimetableRoutineLinks(): Promise<Record<string, number>> {
  const fromDb = await loadFromSupabase();
  const fromStorage = loadFromStorage();
  const merged = { ...fromStorage, ...fromDb };
  if (Object.keys(fromDb).length === 0 && Object.keys(fromStorage).length > 0) {
    await saveToSupabase(fromStorage);
  }
  saveToStorage(merged);
  return merged;
}

/** 타임테이블 항목에 연동된 루틴 항목 ID. links는 loadTimetableRoutineLinks() 결과 */
export function getRoutineIdByTimetableId(links: Record<string, number>, timetableItemId: string): number | null {
  const id = links[timetableItemId];
  return id != null ? id : null;
}

/** 루틴 항목과 연동된 타임테이블 항목 ID 목록. links는 loadTimetableRoutineLinks() 결과 */
export function getTimetableIdsByRoutineId(links: Record<string, number>, routineItemId: number): string[] {
  return Object.entries(links)
    .filter(([, rid]) => rid === routineItemId)
    .map(([tid]) => tid);
}

/** 연동 설정/해제. routineItemId null이면 연동 해제. currentLinks 있으면 그걸 기준으로 갱신(기기 동기화 시 권장) */
export async function setTimetableRoutineLink(
  timetableItemId: string,
  routineItemId: number | null,
  currentLinks?: Record<string, number>
): Promise<void> {
  const links = currentLinks != null ? { ...currentLinks } : loadFromStorage();
  if (routineItemId == null) {
    delete links[timetableItemId];
  } else {
    links[timetableItemId] = routineItemId;
  }
  saveToStorage(links);
  await saveToSupabase(links);
}

/** 항목 삭제 시 해당 연동 제거. currentLinks 있으면 그걸 기준으로 갱신 */
export async function removeLinkByTimetableId(
  timetableItemId: string,
  currentLinks?: Record<string, number>
): Promise<void> {
  await setTimetableRoutineLink(timetableItemId, null, currentLinks);
}
