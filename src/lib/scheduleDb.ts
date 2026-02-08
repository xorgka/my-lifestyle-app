/**
 * 스케줄: 공휴일(scheduleHolidays) + 사용자 등록( Supabase / localStorage )
 */

import { supabase } from "./supabase";
import { getHolidaysOn, getHolidaysInRange, type HolidayItem } from "./scheduleHolidays";
import { localDateStr } from "./dateUtil";

export type ScheduleType = "once" | "monthly" | "yearly" | "weekly";

export type ScheduleEntry = {
  id: string;
  title: string;
  scheduleType: ScheduleType;
  onceDate: string | null;
  monthlyDay: number | null;
  yearlyMonth: number | null;
  yearlyDay: number | null;
  weeklyDay: number | null; // 0=일..6=토
  /** 선택: 시간 (HH:mm). 없으면 null */
  time: string | null;
  createdAt: string;
};

/** 목록에 보여줄 한 건 (날짜별로 펼친 결과) */
export type ScheduleItem = {
  date: string;
  title: string;
  type: "holiday" | "user" | "builtin";
  entryId?: string;
  /** builtin일 때 수정/삭제용 고유 키 */
  builtinId?: string;
  scheduleType?: ScheduleType;
  /** builtin일 때 표시용: 생일 vs 기타 */
  builtinKind?: "birthday" | "other";
  /** 선택: 시간 (HH:mm) */
  time?: string | null;
  /** user일 때만: 추가 순서 정렬용 */
  createdAt?: string;
};

/** 기본 등록 생일 (매년 반복) */
const BUILTIN_YEARLY_BIRTHDAY: { month: number; day: number; title: string }[] = [
  { month: 2, day: 10, title: "창환 생일" },
  { month: 2, day: 13, title: "엄마 생일" },
  { month: 2, day: 28, title: "한울 생일" },
  { month: 3, day: 10, title: "아빠 생일" },
  { month: 6, day: 9, title: "누나 생일" },
  { month: 8, day: 25, title: "내 생일" },
  { month: 10, day: 16, title: "성준 생일" },
  { month: 11, day: 16, title: "수달 생일" },
];

/** 기본 등록 기타 (매년 반복, 공휴일 아님) */
const BUILTIN_YEARLY_OTHER: { month: number; day: number; title: string }[] = [
  { month: 5, day: 8, title: "어버이날" },
  { month: 7, day: 17, title: "제헌절" },
];

/** 기본 등록 기타 (특정일 1회) */
const BUILTIN_ONCE: { date: string; title: string }[] = [
  { date: "2026-02-06", title: "동계올림픽" },
  { date: "2026-06-03", title: "제9회 전국동시지방선거" },
  { date: "2026-06-11", title: "월드컵" },
];

const STORAGE_KEY = "my-lifestyle-schedule-entries";
const BUILTIN_DELETED_KEY = "my-lifestyle-schedule-builtin-deleted";

function loadBuiltinDeleted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(BUILTIN_DELETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveBuiltinDeletedToStorage(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUILTIN_DELETED_KEY, JSON.stringify([...ids]));
  } catch {}
}

/** Supabase에 저장된 builtin 삭제 목록을 localStorage에 반영 (기기 간 동기화) */
export async function syncBuiltinDeletedFromSupabase(): Promise<void> {
  if (!supabase || typeof window === "undefined") return;
  try {
    const { data, error } = await supabase.from("schedule_builtin_deleted").select("builtin_id");
    if (error) {
      console.error("[schedule] syncBuiltinDeletedFromSupabase", error);
      return;
    }
    const ids = new Set((data ?? []).map((r) => String(r.builtin_id)));
    saveBuiltinDeletedToStorage(ids);
  } catch (e) {
    console.error("[schedule] syncBuiltinDeletedFromSupabase", e);
  }
}

/** 시스템 등록(builtin) 일정 삭제 처리 (목록에서 숨김). Supabase 연동 시 기기 간 동기화 */
export function deleteBuiltin(builtinId: string): void {
  const set = loadBuiltinDeleted();
  set.add(builtinId);
  saveBuiltinDeletedToStorage(set);
  if (supabase) {
    supabase.from("schedule_builtin_deleted").upsert({ builtin_id: builtinId }, { onConflict: "builtin_id" }).then(({ error }) => {
      if (error) console.error("[schedule] deleteBuiltin", error);
    });
  }
  notifyScheduleChanged();
}

function loadFromStorage(): ScheduleEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      scheduleType: (r.scheduleType as ScheduleType) ?? "once",
      onceDate: r.onceDate != null ? String(r.onceDate) : null,
      monthlyDay: r.monthlyDay != null ? Number(r.monthlyDay) : null,
      yearlyMonth: r.yearlyMonth != null ? Number(r.yearlyMonth) : null,
      yearlyDay: r.yearlyDay != null ? Number(r.yearlyDay) : null,
      weeklyDay: r.weeklyDay != null ? Number(r.weeklyDay) : null,
      time: r.time != null && r.time !== "" ? String(r.time) : null,
      createdAt: String(r.createdAt ?? ""),
    }));
  } catch {
    return [];
  }
}

function saveToStorage(entries: ScheduleEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export async function loadScheduleEntries(): Promise<ScheduleEntry[]> {
  if (!supabase) return loadFromStorage();
  try {
    await syncBuiltinDeletedFromSupabase();
    const { data, error } = await supabase
      .from("schedule_entries")
      .select("id, title, schedule_type, once_date, monthly_day, yearly_month, yearly_day, weekly_day, time, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    let list = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title ?? "",
      scheduleType: (row.schedule_type as ScheduleType) ?? "once",
      onceDate: row.once_date ?? null,
      monthlyDay: row.monthly_day ?? null,
      yearlyMonth: row.yearly_month ?? null,
      yearlyDay: row.yearly_day ?? null,
      weeklyDay: row.weekly_day ?? null,
      time: row.time != null && row.time !== "" ? String(row.time) : null,
      createdAt: row.created_at ?? new Date().toISOString(),
    }));
    // DB가 비어있고 로컬에 데이터가 있으면 로컬 → Supabase 마이그레이션 (기기 간 동기화)
    if (list.length === 0) {
      const local = loadFromStorage();
      if (local.length > 0) {
        for (const e of local) {
          const { error: insertErr } = await supabase.from("schedule_entries").insert({
            title: e.title,
            schedule_type: e.scheduleType,
            once_date: e.onceDate ?? null,
            monthly_day: e.monthlyDay ?? null,
            yearly_month: e.yearlyMonth ?? null,
            yearly_day: e.yearlyDay ?? null,
            weekly_day: e.weeklyDay ?? null,
            time: e.time ?? null,
          });
          if (insertErr) console.error("[schedule] migrate local→Supabase", e.id, insertErr);
        }
        const { data: refetch, error: refetchErr } = await supabase
          .from("schedule_entries")
          .select("id, title, schedule_type, once_date, monthly_day, yearly_month, yearly_day, weekly_day, time, created_at")
          .order("created_at", { ascending: false });
        if (!refetchErr && refetch) {
          list = refetch.map((row) => ({
            id: row.id,
            title: row.title ?? "",
            scheduleType: (row.schedule_type as ScheduleType) ?? "once",
            onceDate: row.once_date ?? null,
            monthlyDay: row.monthly_day ?? null,
            yearlyMonth: row.yearly_month ?? null,
            yearlyDay: row.yearly_day ?? null,
            weeklyDay: row.weekly_day ?? null,
            time: row.time != null && row.time !== "" ? String(row.time) : null,
            createdAt: row.created_at ?? new Date().toISOString(),
          }));
        }
      }
    }
    return list;
  } catch (e) {
    console.error("[schedule] loadScheduleEntries 실패. PC·스마트폰 동기화를 위해 Supabase URL/키 설정과 schedule_entries 테이블을 확인하세요.", e);
    return loadFromStorage();
  }
}

function entryMatchesDate(entry: ScheduleEntry, dateStr: string): boolean {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = d.getDay();

  switch (entry.scheduleType) {
    case "once":
      return entry.onceDate === dateStr;
    case "monthly":
      return entry.monthlyDay === day;
    case "yearly":
      return entry.yearlyMonth === m && entry.yearlyDay === day;
    case "weekly":
      return entry.weeklyDay === dayOfWeek;
    default:
      return false;
  }
}

function expandEntriesInRange(entries: ScheduleEntry[], start: string, end: string): ScheduleItem[] {
  const result: ScheduleItem[] = [];
  const startD = new Date(start);
  const endD = new Date(end);
  for (let t = startD.getTime(); t <= endD.getTime(); t += 86400000) {
    const dateStr = localDateStr(new Date(t));
    for (const e of entries) {
      if (entryMatchesDate(e, dateStr)) {
        result.push({
          date: dateStr,
          title: e.title,
          type: "user",
          entryId: e.id,
          scheduleType: e.scheduleType,
          time: e.time ?? undefined,
          createdAt: e.createdAt,
        });
      }
    }
  }
  return result;
}

function expandBuiltinInRange(start: string, end: string): ScheduleItem[] {
  const deleted = loadBuiltinDeleted();
  const result: ScheduleItem[] = [];
  const startD = new Date(start);
  const endD = new Date(end);
  for (let t = startD.getTime(); t <= endD.getTime(); t += 86400000) {
    const d = new Date(t);
    const dateStr = localDateStr(d);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    for (const b of BUILTIN_YEARLY_BIRTHDAY) {
      const builtinId = `birthday:${b.month}:${b.day}:${b.title}`;
      if (deleted.has(builtinId)) continue;
      if (b.month === m && b.day === day) {
        result.push({
          date: dateStr,
          title: b.title,
          type: "builtin",
          builtinId,
          scheduleType: "yearly",
          builtinKind: "birthday",
        });
      }
    }
    for (const b of BUILTIN_YEARLY_OTHER) {
      const builtinId = `yearly-other:${b.month}:${b.day}:${b.title}`;
      if (deleted.has(builtinId)) continue;
      if (b.month === m && b.day === day) {
        result.push({
          date: dateStr,
          title: b.title,
          type: "builtin",
          builtinId,
          scheduleType: "yearly",
          builtinKind: "other",
        });
      }
    }
  }
  for (const b of BUILTIN_ONCE) {
    const builtinId = `once:${b.date}:${b.title}`;
    if (deleted.has(builtinId)) continue;
    if (b.date >= start && b.date <= end) {
      result.push({
        date: b.date,
        title: b.title,
        type: "builtin",
        builtinId,
        scheduleType: "once",
        builtinKind: "other",
      });
    }
  }
  return result;
}

/** 날짜 구간 내 스케줄 목록 (공휴일 + 기본생일 + 사용자). 날짜순 정렬. builtinVersion 변경 시 재계산 유도용 */
export function getScheduleItemsInRange(
  start: string,
  end: string,
  userEntries: ScheduleEntry[],
  _builtinVersion?: number
): ScheduleItem[] {
  const holidays: ScheduleItem[] = getHolidaysInRange(start, end).map((h: HolidayItem) => ({
    date: h.date,
    title: h.name,
    type: "holiday" as const,
  }));
  const builtinItems = expandBuiltinInRange(start, end);
  const userItems = expandEntriesInRange(userEntries, start, end);
  const combined = [...holidays, ...builtinItems, ...userItems];
  const typeOrder = (t: ScheduleItem["type"]) => (t === "holiday" ? 0 : t === "builtin" ? 1 : 2);
  combined.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (typeOrder(a.type) !== typeOrder(b.type)) return typeOrder(a.type) - typeOrder(b.type);
    if (a.type === "user" && b.type === "user" && a.createdAt && b.createdAt)
      return a.createdAt.localeCompare(b.createdAt);
    return (a.title || "").localeCompare(b.title || "");
  });
  return combined;
}

/** 오늘 날짜에 해당하는 스케줄 개수 (사이드바 배지용) */
export function getTodayScheduleCount(items: ScheduleItem[]): number {
  const today = localDateStr(new Date());
  return items.filter((i) => i.date === today).length;
}

/** 오늘 스케줄 개수 (공휴일+사용자). 배지용 */
export function getTodayCount(entries: ScheduleEntry[]): number {
  const today = localDateStr(new Date());
  return getScheduleItemsInRange(today, today, entries).length;
}

export async function addScheduleEntry(entry: Omit<ScheduleEntry, "id" | "createdAt">): Promise<ScheduleEntry> {
  const createdAt = new Date().toISOString();
  if (!supabase) {
    const newEntry: ScheduleEntry = {
      ...entry,
      id: `local-${Date.now()}`,
      createdAt,
    };
    const list = loadFromStorage();
    list.unshift(newEntry);
    saveToStorage(list);
    notifyScheduleChanged();
    return newEntry;
  }
  const { data, error } = await supabase
    .from("schedule_entries")
    .insert({
      title: entry.title,
      schedule_type: entry.scheduleType,
      once_date: entry.onceDate ?? null,
      monthly_day: entry.monthlyDay ?? null,
      yearly_month: entry.yearlyMonth ?? null,
      yearly_day: entry.yearlyDay ?? null,
      weekly_day: entry.weeklyDay ?? null,
      time: entry.time ?? null,
    })
    .select("id, title, schedule_type, once_date, monthly_day, yearly_month, yearly_day, weekly_day, time, created_at")
    .single();
  if (error) {
    console.error("[schedule] addScheduleEntry", error);
    const fallback: ScheduleEntry = { ...entry, id: `local-${Date.now()}`, createdAt, time: entry.time ?? null };
    const list = loadFromStorage();
    list.unshift(fallback);
    saveToStorage(list);
    notifyScheduleChanged();
    return fallback;
  }
  notifyScheduleChanged();
  return {
    id: data.id,
    title: data.title ?? "",
    scheduleType: (data.schedule_type as ScheduleType) ?? "once",
    onceDate: data.once_date ?? null,
    monthlyDay: data.monthly_day ?? null,
    yearlyMonth: data.yearly_month ?? null,
    yearlyDay: data.yearly_day ?? null,
    weeklyDay: data.weekly_day ?? null,
    time: data.time != null && data.time !== "" ? String(data.time) : null,
    createdAt: data.created_at ?? createdAt,
  };
}

export async function updateScheduleEntry(
  id: string,
  patch: Partial<Omit<ScheduleEntry, "id" | "createdAt">>
): Promise<void> {
  if (id.startsWith("local-") || !supabase) {
    const list = loadFromStorage();
    const idx = list.findIndex((e) => e.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      saveToStorage(list);
      notifyScheduleChanged();
    }
    return;
  }
  const row: Record<string, unknown> = {};
  if (patch.title != null) row.title = patch.title;
  if (patch.scheduleType != null) row.schedule_type = patch.scheduleType;
  if (patch.onceDate != null) row.once_date = patch.onceDate;
  if (patch.monthlyDay != null) row.monthly_day = patch.monthlyDay;
  if (patch.yearlyMonth != null) row.yearly_month = patch.yearlyMonth;
  if (patch.yearlyDay != null) row.yearly_day = patch.yearlyDay;
  if (patch.weeklyDay != null) row.weekly_day = patch.weeklyDay;
  if (patch.time !== undefined) row.time = patch.time;
  const { error } = await supabase.from("schedule_entries").update(row).eq("id", id);
  if (error) console.error("[schedule] updateScheduleEntry", error);
  else notifyScheduleChanged();
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  if (id.startsWith("local-") || !supabase) {
    const list = loadFromStorage().filter((e) => e.id !== id);
    saveToStorage(list);
    notifyScheduleChanged();
    return;
  }
  const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
  if (error) console.error("[schedule] deleteScheduleEntry", error);
  else notifyScheduleChanged();
}

/** 스케줄 목록이 바뀌었을 때 사이드바 배지 갱신용 (dispatchEvent) */
export function notifyScheduleChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("schedule-changed"));
  }
}

/** 오늘/내일 뷰에서 완료 체크용 키 (user 또는 builtin 항목만) */
export function getScheduleCompletionKey(item: ScheduleItem, dateStr: string): string | null {
  if (item.type === "user" && item.entryId) return `user:${item.entryId}:${dateStr}`;
  if (item.type === "builtin" && item.builtinId) return `builtin:${item.builtinId}:${dateStr}`;
  return null;
}

const COMPLETIONS_STORAGE_KEY = "my-lifestyle-schedule-completions";

export function loadScheduleCompletions(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COMPLETIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveScheduleCompletions(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify([...set]));
  } catch {}
}

/** 항목별 정렬용 고유 키 (PC 드래그 순서 저장에 사용) */
export function getScheduleItemOrderKey(item: ScheduleItem, dateStr: string): string {
  if (item.type === "user" && item.entryId) return `user:${item.entryId}`;
  if (item.type === "builtin" && item.builtinId) return `builtin:${item.builtinId}`;
  return `holiday:${dateStr}:${item.title}`;
}

const ORDER_STORAGE_KEY = "my-lifestyle-schedule-order";

export function loadScheduleOrder(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, string[]>;
    return {};
  } catch {
    return {};
  }
}

export function saveScheduleOrder(order: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {}
}
