/**
 * 알림 팝업 "마지막 표시" 시각 저장.
 * Supabase 연결 시 reminder_last_shown 테이블 사용(기기/브라우저 동기화), 없으면 localStorage.
 */

import { supabase } from "./supabase";
import { todayStr } from "./dateUtil";

export type ReminderType = "shower" | "gym" | "youtube" | "morning_face";

const STORAGE_PREFIX = "reminder-last-";

function storageKey(type: ReminderType): string {
  return `${STORAGE_PREFIX}${type}`;
}

function loadFromStorage(type: ReminderType): { date: string; time: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(type));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; time: number };
    return parsed?.date && typeof parsed.time === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function saveToStorage(type: ReminderType, date: string, time: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(type), JSON.stringify({ date, time }));
  } catch {}
}

/** 해당 알림 타입의 마지막 표시 시각 (날짜 + ms). 없으면 null */
export async function getReminderLastShown(
  type: ReminderType
): Promise<{ date: string; time: number } | null> {
  if (supabase) {
    const { data: row, error } = await supabase
      .from("reminder_last_shown")
      .select("last_shown_at")
      .eq("reminder_type", type)
      .maybeSingle();
    if (error) {
      console.warn("[reminderLastShown] get", type, error.message);
      return loadFromStorage(type);
    }
    if (!row?.last_shown_at) return null;
    const d = new Date(row.last_shown_at);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date, time: d.getTime() };
  }
  return loadFromStorage(type);
}

/** 해당 알림 타입의 마지막 표시를 지금으로 기록 */
export async function setReminderLastShown(type: ReminderType): Promise<void> {
  const now = Date.now();
  const date = todayStr();
  if (supabase) {
    const { error } = await supabase
      .from("reminder_last_shown")
      .upsert({ reminder_type: type, last_shown_at: new Date(now).toISOString() }, { onConflict: "reminder_type" });
    if (error) {
      console.warn("[reminderLastShown] set", type, error.message);
      saveToStorage(type, date, now);
    }
    return;
  }
  saveToStorage(type, date, now);
}
