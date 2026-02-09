/**
 * 유튜브 실제 입금 금액: Supabase 연결 시 DB 사용(기기·브라우저 동기화), 없으면 localStorage
 */

import { supabase } from "./supabase";

const STORAGE_KEY = "youtube-actual-deposits";

function loadFromStorage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/** 전체 로드. Supabase 우선, 없으면 localStorage. DB 비어 있고 localStorage 있으면 한 번 업로드 후 반환 */
export async function loadYoutubeActualDeposits(): Promise<Record<string, number>> {
  if (supabase) {
    const { data, error } = await supabase
      .from("youtube_actual_deposits")
      .select("deposit_key, amount_krw");
    if (error) {
      console.error("[youtube] loadYoutubeActualDeposits", error);
      return loadFromStorage();
    }
    const fromDb =
      (data ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.deposit_key] = row.amount_krw ?? 0;
        return acc;
      }, {}) ?? {};
    if (Object.keys(fromDb).length > 0) return fromDb;
    const fromStorage = loadFromStorage();
    if (Object.keys(fromStorage).length > 0) {
      await saveYoutubeActualDeposits(fromStorage);
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      return fromStorage;
    }
    return fromDb;
  }
  return loadFromStorage();
}

/** 전체 저장 (Supabase면 upsert, 아니면 localStorage) */
export async function saveYoutubeActualDeposits(data: Record<string, number>): Promise<void> {
  if (supabase) {
    const rows = Object.entries(data).map(([deposit_key, amount_krw]) => ({
      deposit_key,
      amount_krw,
    }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("youtube_actual_deposits").upsert(rows, {
      onConflict: "deposit_key",
    });
    if (error) console.error("[youtube] saveYoutubeActualDeposits", error);
    return;
  }
  saveToStorage(data);
}
