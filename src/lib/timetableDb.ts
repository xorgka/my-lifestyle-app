/**
 * 타임테이블: 날짜별 시간대·항목·완료. 과거 날짜는 소급 변경 없음.
 * Supabase 연결 시 DB, 없으면 localStorage.
 */

import { supabase } from "./supabase";

export type TimetableItem = { id: string; text: string };
export type TimetableSlot = { id: string; time: string; items: TimetableItem[] };
export type DayTimetable = { slots: TimetableSlot[]; completedIds: string[] };

/** 5시를 하루 시작으로, 0~4시는 늦은 시간(맨 뒤). 정렬용 키 반환. */
export function timetableSlotOrderKey(time: string): number {
  const n = parseInt(String(time).trim(), 10) || 0;
  if (n >= 5 && n <= 24) return n - 5;
  return n + 19;
}

/** 슬롯을 5시 시작·늦은시간 맨 뒤 순서로 정렬 */
export function sortTimetableSlots(slots: TimetableSlot[]): TimetableSlot[] {
  return [...slots].sort((a, b) => timetableSlotOrderKey(a.time) - timetableSlotOrderKey(b.time));
}

/** 해당 날짜만 적용되는 시작시간 오버라이드(0~23). null이면 기존 슬롯 시간 그대로 */
const START_TIME_OVERRIDE_KEY = "timetable-start-time";

export function getStartTimeOverrideForKey(key: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${START_TIME_OVERRIDE_KEY}-${key}`);
  if (raw == null || raw === "") return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n > 23) return null;
  return n;
}

export function setStartTimeOverrideForKey(key: string, hour: number | null): void {
  if (typeof window === "undefined") return;
  if (hour == null) {
    window.localStorage.removeItem(`${START_TIME_OVERRIDE_KEY}-${key}`);
    return;
  }
  window.localStorage.setItem(`${START_TIME_OVERRIDE_KEY}-${key}`, String(hour));
}

/** 오버라이드가 있을 때 슬롯의 표시 시각(0~23) */
export function getSlotDisplayHour(slotTime: string, firstSlotHour: number, startTimeOverride: number): number {
  const slotHour = parseInt(String(slotTime).trim(), 10);
  if (Number.isNaN(slotHour)) return 0;
  const raw = slotHour + (startTimeOverride - firstSlotHour);
  return ((raw % 24) + 24) % 24;
}

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

/** 특정 날짜 타임테이블 로드. 오늘·미래는 오늘 구조 기준, 과거는 저장된 그대로. 오늘 데이터 없으면 어제 복사 */
export async function loadTimetableForDate(key: string): Promise<LoadTimetableResult> {
  const all = await loadAllTimetables();
  const todayKey = getTodayKey();

  if (key === todayKey) {
    if (all[key]) return { day: all[key], copiedFrom: null };
    const yesterdayKey = getDateKeyOffset(todayKey, -1);
    const template = all[yesterdayKey] ?? getDefaultDay();
    const newDay = deepCopyDay(template);
    const nextAll = { ...all, [key]: newDay };
    saveToStorage(nextAll);
    await saveToSupabase(nextAll);
    return { day: newDay, copiedFrom: yesterdayKey };
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
