/**
 * 수면 관리: 날짜별 기상/취침 시간 저장.
 * Supabase 연결 시 sleep_records 테이블 사용(기기 동기화), 없으면 localStorage.
 * 형식: { [YYYY-MM-DD]: { wakeTime?: "HH:mm", bedTime?: "HH:mm" } }
 * bedTime = 해당 날짜로 잔 밤(전날 밤)의 취침 시각.
 */

import { supabase } from "./supabase";

const STORAGE_KEY = "sleep-data";

export type SleepRecord = {
  wakeTime?: string;
  bedTime?: string;
};

export type SleepData = Record<string, SleepRecord>;

function loadFromStorage(): SleepData {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SleepData;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: SleepData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export type SleepLoadResult = { data: SleepData; source: "supabase" | "local" };

/** 전체 수면 데이터 로드. source로 기기 동기화 여부 확인 가능 */
export async function loadSleepData(): Promise<SleepLoadResult> {
  if (supabase) {
    const { data: rows, error } = await supabase
      .from("sleep_records")
      .select("date, wake_time, bed_time");
    if (error) {
      console.warn("[sleepDb] loadSleepData (Supabase)", error.message, "- localStorage 사용. sleep_records 테이블 생성 여부 확인.");
      return { data: loadFromStorage(), source: "local" };
    }
    const out: SleepData = {};
    (rows ?? []).forEach((row) => {
      const key = row.date;
      if (key) {
        out[key] = {};
        if (row.wake_time != null) out[key].wakeTime = row.wake_time;
        if (row.bed_time != null) out[key].bedTime = row.bed_time;
      }
    });
    return { data: out, source: "supabase" };
  }
  return { data: loadFromStorage(), source: "local" };
}

/** 특정 날짜 수면 기록 저장 (wakeTime/bedTime 일부만 넘겨도 병합) */
export async function saveSleepRecord(
  dateKey: string,
  record: Partial<SleepRecord>
): Promise<void> {
  if (supabase) {
    const { data: row } = await supabase
      .from("sleep_records")
      .select("wake_time, bed_time")
      .eq("date", dateKey)
      .maybeSingle();
    const current = row
      ? { wakeTime: row.wake_time ?? undefined, bedTime: row.bed_time ?? undefined }
      : {};
    const wakeTime = record.wakeTime !== undefined ? record.wakeTime : current.wakeTime;
    const bedTime = record.bedTime !== undefined ? record.bedTime : current.bedTime;
    const { error } = await supabase
      .from("sleep_records")
      .upsert(
        { date: dateKey, wake_time: wakeTime ?? null, bed_time: bedTime ?? null },
        { onConflict: "date" }
      );
    if (error) {
      console.warn("[sleepDb] saveSleepRecord (Supabase)", error.message);
      const data = loadFromStorage();
      const merged = { ...(data[dateKey] ?? {}), ...record };
      data[dateKey] = merged;
      saveToStorage(data);
    }
    return;
  }
  const data = loadFromStorage();
  const current = data[dateKey] ?? {};
  data[dateKey] = {
    ...current,
    ...(record.wakeTime !== undefined && { wakeTime: record.wakeTime }),
    ...(record.bedTime !== undefined && { bedTime: record.bedTime }),
  };
  saveToStorage(data);
}

/** 특정 날짜 수면 기록 삭제(초기화) */
export async function deleteSleepRecord(dateKey: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("sleep_records").delete().eq("date", dateKey);
    if (error) {
      console.warn("[sleepDb] deleteSleepRecord (Supabase)", error.message);
      const data = loadFromStorage();
      delete data[dateKey];
      saveToStorage(data);
    }
    return;
  }
  const data = loadFromStorage();
  delete data[dateKey];
  saveToStorage(data);
}

/** 특정 날짜의 기상 또는 취침만 삭제 */
export async function clearSleepRecordField(
  dateKey: string,
  field: "wakeTime" | "bedTime"
): Promise<void> {
  if (supabase) {
    const { data: row } = await supabase
      .from("sleep_records")
      .select("wake_time, bed_time")
      .eq("date", dateKey)
      .maybeSingle();
    const current = row
      ? { wakeTime: row.wake_time ?? undefined, bedTime: row.bed_time ?? undefined }
      : {};
    if (field === "wakeTime") current.wakeTime = undefined;
    else current.bedTime = undefined;
    const { error } = await supabase
      .from("sleep_records")
      .upsert(
        {
          date: dateKey,
          wake_time: current.wakeTime ?? null,
          bed_time: current.bedTime ?? null,
        },
        { onConflict: "date" }
      );
    if (error) {
      console.warn("[sleepDb] clearSleepRecordField (Supabase)", error.message);
      const data = loadFromStorage();
      const rec = data[dateKey] ?? {};
      if (field === "wakeTime") delete rec.wakeTime;
      else delete rec.bedTime;
      if (Object.keys(rec).length === 0) delete data[dateKey];
      else data[dateKey] = rec;
      saveToStorage(data);
    }
    return;
  }
  const data = loadFromStorage();
  const rec = data[dateKey] ?? {};
  if (field === "wakeTime") delete rec.wakeTime;
  else delete rec.bedTime;
  if (Object.keys(rec).length === 0) delete data[dateKey];
  else data[dateKey] = rec;
  saveToStorage(data);
}
