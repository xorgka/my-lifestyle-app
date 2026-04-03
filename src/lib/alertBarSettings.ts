/**
 * 알림바 사용자 설정: 추가 문구 + 시스템 알림 표시/문구 변경
 * localStorage + Supabase 연결 시 기기/브라우저 동기화 (팝업 설정과 동일 패턴)
 */

import { supabase } from "./supabase";

const STORAGE_KEY_CUSTOM = "alert-bar-custom";
const STORAGE_KEY_OVERRIDES = "alert-bar-overrides";
const SUPABASE_ROW_ID = "default";

/** 동기화·저장 후 알림바 UI가 localStorage를 다시 읽도록 브로드캐스트 */
export const ALERT_BAR_SETTINGS_SYNC_EVENT = "alert-bar-settings-synced";

function dispatchAlertBarSettingsSynced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ALERT_BAR_SETTINGS_SYNC_EVENT));
}

export type TimePreset = "always" | "custom";

export type CustomAlertItem = {
  id: string;
  text: string;
  /** 탭 시 이동할 경로. 비우면 홈(/) */
  href?: string;
  timePreset?: TimePreset;
  /** 직접 설정 시: 노출 시작 시각 (0~23). 예: 22 = 22시부터 */
  timeFrom?: number;
  /** 직접 설정 시: 노출 끝 시각 (0~23). 예: 5 = 5시까지 (자정 넘기면 다음날 5시 전까지) */
  timeTo?: number;
};

export type SystemAlertOverride = {
  disabled?: boolean;
  customText?: string;
};

export type SystemAlertDefinition = {
  key: string;
  defaultLabel: string;
  /** 데이터로 채워지는 부분 안내. 있으면 설정 화면에 표시 (문구 변경 시 해당 부분은 자동 반영 안 됨) */
  variableHint?: string;
};

/** 종류별 탭 (시스템 알림 설정용) */
export type SystemAlertCategoryId = "sleep" | "schedule" | "routine" | "journal" | "budget" | "motto";

export const SYSTEM_ALERT_CATEGORIES: { id: SystemAlertCategoryId; label: string; keys: string[] }[] = [
  { id: "sleep", label: "수면", keys: ["sleep_bedtime"] },
  { id: "schedule", label: "일정", keys: ["birthday", "schedule"] },
  { id: "routine", label: "루틴", keys: ["routine_incomplete", "routine_rate", "routine_month", "gym"] },
  { id: "journal", label: "일기", keys: ["journal_streak"] },
  { id: "budget", label: "지출", keys: ["budget_today", "budget_today_none", "budget_15_more", "budget_month_monday"] },
  { id: "motto", label: "멘트", keys: ["antivision", "godsae", "muscle", "pace", "stillness"] },
];

/** 설정 UI에 노출할 시스템 알림 목록 (키 + 기본 문구 예시 + 변하는 부분 안내) */
export const SYSTEM_ALERT_DEFINITIONS: SystemAlertDefinition[] = [
  { key: "sleep_bedtime", defaultLabel: "어제 N시M분에 잠에 들었어요.💤", variableHint: "{TIME} = 취침 시각 (예: 11시30분). 예: \"어제 {TIME}에 잠들었어요.💤\"" },
  { key: "birthday", defaultLabel: "생일 알림 (오늘/D-1/D-5)", variableHint: "문구를 바꾸면 한 가지 문구로만 나와요. (여러 생일이 있어도 하나만 표시)" },
  { key: "schedule", defaultLabel: "오늘/내일 일정 & 다가오는 시간", variableHint: "문구를 바꾸면 한 가지 문구로만 나와요. (여러 일정이 있어도 하나만 표시)" },
  { key: "routine_incomplete", defaultLabel: "오늘 루틴 N개 남았어요. 📋", variableHint: "{N} = 미완료 개수, {total} = 전체 개수. 예: \"루틴 {N}/{total}개 남았어요 📋\"" },
  { key: "routine_rate", defaultLabel: "[PM] 루틴 달성률 N% 🕐", variableHint: "{TIME} = 현재 시각, {N} = 달성률(%). 예: \"{TIME} 루틴 {N}% 🕐\"" },
  { key: "journal_streak", defaultLabel: "일기 연속 N일 작성 중이에요!", variableHint: "{N} = 연속 작성일. 예: \"일기 연속 {N}일 작성 중!\"" },
  { key: "budget_today", defaultLabel: "오늘의 지출은 N원이에요.", variableHint: "{N} = 오늘 지출 합계(원). 예: \"오늘 지출 {N}원이에요.\"" },
  { key: "budget_today_none", defaultLabel: "오늘 가계부 작성하셨나요?", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
  { key: "budget_15_more", defaultLabel: "이번달 지출이 좀 많아요.", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
  { key: "budget_month_monday", defaultLabel: "이번달 총 지출 N만원 (월요일)", variableHint: "{N} = 이번달 총 지출(만원 단위). 예: \"이번달 총 지출 {N} (월요일)\"" },
  { key: "routine_month", defaultLabel: "이번달 독서/헬스 등 N일 했어요. 🔥", variableHint: "{label} = 항목명(독서/헬스장 등), {N} = 일수, {verb} = 했어요/갔어요. 예: \"이번달 {label} {N}일 {verb}. 🔥\"" },
  { key: "antivision", defaultLabel: "지금 멍때리고 있다면 안티비젼에 답변해보세요.", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
  { key: "godsae", defaultLabel: "갓생의 시작은 일찍 자는 것부터입니다.", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
  { key: "gym", defaultLabel: "헬스장 연속/미달성 멘트 💪⚠️", variableHint: "{N} = 연속 일수 또는 미달성 일수. 예: \"{N}일째 헬스장 안 가고 있어요! ⚠️\"" },
  { key: "muscle", defaultLabel: "근육 1kg은 1500만원의 가치가 있다.", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
  { key: "pace", defaultLabel: "당신의 속도대로 천천히.", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
  { key: "stillness", defaultLabel: "가만히 있으면 아무 변화도 없다.", variableHint: "고정 문구. 원하는 대로 바꿔도 돼요." },
];

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

function normalizeCustomAlert(item: CustomAlertItem): CustomAlertItem {
  const preset = item.timePreset as string | undefined;
  if (preset === "22-5") {
    return { ...item, timePreset: "custom", timeFrom: 22, timeTo: 5 };
  }
  if (preset === "21-3") {
    return { ...item, timePreset: "custom", timeFrom: 21, timeTo: 3 };
  }
  return item;
}

export function loadCustomAlerts(): CustomAlertItem[] {
  const raw = loadJson<CustomAlertItem[]>(STORAGE_KEY_CUSTOM, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCustomAlert);
}

export function saveCustomAlerts(items: CustomAlertItem[]): void {
  saveJson(STORAGE_KEY_CUSTOM, items);
  void saveAlertBarSettingsToSupabase();
  dispatchAlertBarSettingsSynced();
}

/** Supabase에서 알림바 설정을 가져와 localStorage에 반영. 앱 로드·설정 탭 진입 시 호출 */
export async function syncAlertBarSettingsFromSupabase(): Promise<void> {
  if (!supabase || typeof window === "undefined") return;
  try {
    const { data: row, error } = await supabase
      .from("alert_bar_settings")
      .select("system_overrides, custom_alerts")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle();
    if (error || !row) return;

    const so = row.system_overrides as Record<string, SystemAlertOverride> | null;
    const ca = row.custom_alerts as unknown;
    const serverEmpty =
      (!so || typeof so !== "object" || Object.keys(so).length === 0) &&
      (!Array.isArray(ca) || ca.length === 0);

    const localSo = loadJson<Record<string, SystemAlertOverride>>(STORAGE_KEY_OVERRIDES, {});
    const localCa = loadJson<CustomAlertItem[]>(STORAGE_KEY_CUSTOM, []);
    const localHas =
      (localSo && typeof localSo === "object" && Object.keys(localSo).length > 0) ||
      (Array.isArray(localCa) && localCa.length > 0);

    // 서버만 비어 있고 로컬에 멘트/알림이 있으면: 기존 local → Supabase로 한 번 밀어 넣음(초기 마이그레이션)
    if (serverEmpty && localHas) {
      await saveAlertBarSettingsToSupabase();
      dispatchAlertBarSettingsSynced();
      return;
    }
    if (!serverEmpty) {
      saveJson(STORAGE_KEY_OVERRIDES, so && typeof so === "object" ? so : {});
      saveJson(
        STORAGE_KEY_CUSTOM,
        Array.isArray(ca) ? (ca as CustomAlertItem[]).map(normalizeCustomAlert) : []
      );
      dispatchAlertBarSettingsSynced();
    }
  } catch {
    // ignore
  }
}

async function saveAlertBarSettingsToSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const system_overrides = loadJson<Record<string, SystemAlertOverride>>(STORAGE_KEY_OVERRIDES, {});
    const rawCustom = loadJson<CustomAlertItem[]>(STORAGE_KEY_CUSTOM, []);
    const custom_alerts = Array.isArray(rawCustom) ? rawCustom.map(normalizeCustomAlert) : [];
    await supabase.from("alert_bar_settings").upsert(
      {
        id: SUPABASE_ROW_ID,
        system_overrides: system_overrides && typeof system_overrides === "object" ? system_overrides : {},
        custom_alerts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // ignore
  }
}

export function loadSystemOverrides(): Record<string, SystemAlertOverride> {
  const raw = loadJson<Record<string, SystemAlertOverride>>(STORAGE_KEY_OVERRIDES, {});
  return raw && typeof raw === "object" ? raw : {};
}

export function saveSystemOverrides(overrides: Record<string, SystemAlertOverride>): void {
  saveJson(STORAGE_KEY_OVERRIDES, overrides);
  void saveAlertBarSettingsToSupabase();
  dispatchAlertBarSettingsSynced();
}

/** 사용자 추가 문구가 현재 시간에 표시되는지 */
export function isCustomAlertInTimeWindow(item: CustomAlertItem, currentHour: number): boolean {
  const preset = item.timePreset ?? "always";
  if (preset === "always") return true;
  if (preset !== "custom") return true;
  const from = item.timeFrom ?? 0;
  const to = item.timeTo ?? 23;
  if (from <= to) return currentHour >= from && currentHour <= to;
  return currentHour >= from || currentHour < to;
}

export function generateCustomAlertId(): string {
  return "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
