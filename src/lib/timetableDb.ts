/**
 * 타임테이블: 날짜별 시간대·항목·완료. 과거 날짜는 소급 변경 없음.
 * Supabase 연결 시 DB, 없으면 localStorage.
 */

import { supabase } from "./supabase";

export type TimetableItem = { id: string; text: string };
export type TimetableSlot = { id: string; time: string; items: TimetableItem[] };
export type DayTimetable = { slots: TimetableSlot[]; completedIds: string[] };

const STORAGE_KEY = "timetable-by-date";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function genId(): string {
  return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage(): Record<string, DayTimetable> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DayTimetable>;
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, DayTimetable>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

const DEFAULT_SLOTS: TimetableSlot[] = [
  { id: genId(), time: "9", items: [{ id: genId(), text: "기상 후 아침세안" }, { id: genId(), text: "독서 30P 이상" }] },
  { id: genId(), time: "10", items: [{ id: genId(), text: "산책" }, { id: genId(), text: "아점" }, { id: genId(), text: "씨에스타 (15분)" }] },
  { id: genId(), time: "12", items: [{ id: genId(), text: "언박씬 + JP" }, { id: genId(), text: "씨네토리" }, { id: genId(), text: "무비잉" }] },
  { id: genId(), time: "16", items: [{ id: genId(), text: "헬스장" }] },
  { id: genId(), time: "17", items: [{ id: genId(), text: "저녁 및 휴식" }] },
  { id: genId(), time: "18", items: [{ id: genId(), text: "돌핀 2개" }, { id: genId(), text: "롱폼" }] },
  { id: genId(), time: "19", items: [{ id: genId(), text: "소재 찾고, 다운로드" }] },
  { id: genId(), time: "21", items: [{ id: genId(), text: "자유시간" }] },
];

function deepCopyDay(d: DayTimetable): DayTimetable {
  return {
    slots: d.slots.map((s) => ({
      id: genId(),
      time: s.time,
      items: s.items.map((i) => ({ id: genId(), text: i.text })),
    })),
    completedIds: [],
  };
}

/** 해당 날짜에서 완료된 항목을 (시간\0텍스트) 집합으로 반환 */
function getCompletedTimeTextSet(day: DayTimetable): Set<string> {
  const set = new Set<string>();
  day.slots.forEach((s) => {
    s.items.forEach((i) => {
      if (day.completedIds.includes(i.id)) set.add(`${s.time}\0${i.text}`);
    });
  });
  return set;
}

/** (시간\0텍스트) 완료 집합을 새 day에 적용 */
function applyCompletedSet(day: DayTimetable, completedSet: Set<string>): DayTimetable {
  const completedIds: string[] = [];
  day.slots.forEach((s) => {
    s.items.forEach((i) => {
      if (completedSet.has(`${s.time}\0${i.text}`)) completedIds.push(i.id);
    });
  });
  return { ...day, completedIds };
}

function getDefaultDay(): DayTimetable {
  return deepCopyDay({ slots: DEFAULT_SLOTS, completedIds: [] });
}

/** 이전 날짜 키 반환 (YYYY-MM-DD) */
function prevDateKey(key: string): string | null {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

// --- Supabase (optional) ---
const TABLE_NAME = "timetable_days";

async function loadFromSupabase(): Promise<Record<string, DayTimetable>> {
  if (!supabase) return loadFromStorage();
  const { data, error } = await supabase.from(TABLE_NAME).select("date_key, slots, completed_ids");
  if (error || !Array.isArray(data)) return loadFromStorage();
  const out: Record<string, DayTimetable> = {};
  data.forEach((row: { date_key: string; slots: unknown; completed_ids: string[] }) => {
    const slots = row.slots as DayTimetable["slots"];
    if (slots && Array.isArray(slots)) out[row.date_key] = { slots, completedIds: row.completed_ids ?? [] };
  });
  return out;
}

async function saveToSupabase(data: Record<string, DayTimetable>): Promise<void> {
  if (!supabase) return;
  try {
    const rows = Object.entries(data).map(([date_key, day]) => ({
      date_key,
      slots: day.slots,
      completed_ids: day.completedIds,
    }));
    await supabase.from(TABLE_NAME).upsert(rows, { onConflict: "date_key" });
  } catch {}
}

// --- Public API ---

/** 특정 날짜 타임테이블 로드 결과. copiedFrom이 있으면 어제 데이터를 복사한 것 */
export type LoadTimetableResult = { day: DayTimetable; copiedFrom: string | null };

/** 특정 날짜 타임테이블 로드. 오늘·미래는 오늘 구조 기준, 과거는 저장된 그대로 */
export async function loadTimetableForDate(key: string): Promise<LoadTimetableResult> {
  const all = await loadAllTimetables();
  const todayKey = getTodayKey();

  if (key === todayKey) {
    const day = all[key] ?? getDefaultDay();
    return { day, copiedFrom: null };
  }

  if (key < todayKey) {
    return { day: all[key] ?? getDefaultDay(), copiedFrom: null };
  }

  const template = all[todayKey] ?? getDefaultDay();
  let newDay = deepCopyDay(template);
  const saved = all[key];
  if (saved) {
    const completedSet = getCompletedTimeTextSet(saved);
    newDay = applyCompletedSet(newDay, completedSet);
  }
  const nextAll = { ...all, [key]: newDay };
  saveToStorage(nextAll);
  await saveToSupabase(nextAll);
  return { day: newDay, copiedFrom: todayKey };
}

/** 전체 날짜별 데이터 로드 (Supabase 우선, 없으면 localStorage) */
export async function loadAllTimetables(): Promise<Record<string, DayTimetable>> {
  const fromDb = await loadFromSupabase();
  const fromStorage = loadFromStorage();
  const merged = { ...fromStorage, ...fromDb };
  return merged;
}

/** 특정 날짜 저장. 해당 날짜만 갱신하고 과거는 건드리지 않음 */
export async function saveTimetableForDate(key: string, day: DayTimetable): Promise<void> {
  const all = await loadAllTimetables();
  all[key] = day;
  saveToStorage(all);
  await saveToSupabase(all);
}

/** 이 날짜를 어제 구조로 덮어쓰기. 어제 데이터가 있으면 복사 후 저장하고 { newDay, prevDay } 반환, 없으면 null */
export async function copyDayFromPreviousAndSave(key: string): Promise<{ newDay: DayTimetable; prevDay: DayTimetable } | null> {
  const prev = prevDateKey(key);
  if (!prev) return null;
  const all = await loadAllTimetables();
  const prevDay = all[prev];
  if (!prevDay) return null;
  const newDay = deepCopyDay(prevDay);
  const nextAll = { ...all, [key]: newDay };
  saveToStorage(nextAll);
  await saveToSupabase(nextAll);
  return { newDay, prevDay };
}

export function getTodayKey(): string {
  return dateKey(new Date());
}

export function getDateKeyOffset(key: string, daysOffset: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + daysOffset);
  return dateKey(date);
}

export { genId };
