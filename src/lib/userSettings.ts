/**
 * 기기 간 동기화가 필요한 개인화 설정 (빠른 복사, 홈 템플릿, 즐겨찾기 등)
 *
 * 읽기는 localStorage에서 동기적으로 하고, 쓰기는 localStorage에 먼저 반영한 뒤
 * Supabase(user_settings)로 밀어 넣는다. 앱이 뜰 때 서버 값을 받아 로컬을 덮어쓰므로
 * 다른 PC에서 바꾼 내용이 따라온다. (알림바 설정과 같은 패턴)
 */

import { supabase } from "./supabase";

const TABLE = "user_settings";

/** 동기화가 끝나 localStorage가 바뀌었을 때 UI가 다시 읽도록 알리는 이벤트 */
export const USER_SETTINGS_SYNC_EVENT = "user-settings-synced";

/** 이 목록에 있는 키만 서버와 주고받는다 */
export const SYNCED_SETTING_KEYS = [
  "my-lifestyle-snippets", // 빠른 복사
  "home-template", // 홈 화면 템플릿
  "home-memo-card-style", // 홈 메모 카드 디자인
  "home-alert-bar-enabled", // 홈 알림바 표시 여부
  "home-routine-display-percent", // 홈 루틴 카드 %표시
  "sidebar-hidden-menus", // 사이드바에서 숨긴 메뉴
  "diet-profile", // 다이어트: 키·나이·성별·목표·트레드밀 기본값
  "diet-foods", // 다이어트: 음식별 칼로리 목록
  "diet-combos", // 다이어트: 자주 먹는 식단 조합
  "diet-exercises", // 다이어트: 운동 종류(이름·단위·버튼 값·강도·효과 문구)
  "finance-monthly-goal", // 가계부: 한 달 지출 목표(원)
  "finance-parent-groups", // 가계부: 큰 묶음 (식비 = 배달·편의점·빵 …)
  "my-lifestyle-insights-favorites", // 인사이트 즐겨찾기
  "memo-selected-category-id", // 메모에서 마지막으로 보던 카테고리
  "my-lifestyle-journal-secret-pin-hash", // 일기 비밀글 PIN
] as const;

export type SyncedSettingKey = (typeof SYNCED_SETTING_KEYS)[number];

function dispatchSynced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(USER_SETTINGS_SYNC_EVENT));
}

/** localStorage에서 읽기. 저장된 값이 없거나 깨졌으면 fallback */
export function loadSetting<T>(key: SyncedSettingKey, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // 이 키를 쓰기 전에 저장된 값은 따옴표 없는 원시 문자열일 수 있다
      return raw as unknown as T;
    }
  } catch {
    return fallback;
  }
}

/** localStorage에 저장하고 Supabase로도 올린다 (실패해도 로컬 저장은 유지) */
export function saveSetting<T>(key: SyncedSettingKey, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  void pushSettingToSupabase(key, value);
}

async function pushSettingToSupabase<T>(key: SyncedSettingKey, value: T): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from(TABLE).upsert(
      { key, value: value ?? null, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  } catch {
    // 오프라인이거나 테이블이 아직 없으면 로컬에만 남는다
  }
}

/**
 * 서버 값을 받아 localStorage에 반영한다.
 * 서버에 아직 없는 키는, 이 기기에 값이 있으면 그 값을 서버로 올려 초기화한다.
 */
export async function syncUserSettingsFromSupabase(): Promise<void> {
  if (!supabase || typeof window === "undefined") return;
  try {
    const { data, error } = await supabase.from(TABLE).select("key, value");
    if (error) return;

    const serverMap = new Map<string, unknown>();
    for (const row of data ?? []) serverMap.set(String(row.key), row.value);

    let changed = false;
    for (const key of SYNCED_SETTING_KEYS) {
      if (serverMap.has(key)) {
        const value = serverMap.get(key);
        if (value === null || value === undefined) continue;
        const next = JSON.stringify(value);
        if (window.localStorage.getItem(key) !== next) {
          window.localStorage.setItem(key, next);
          changed = true;
        }
      } else {
        // 서버에 없는 키: 이 기기 값을 올려 첫 동기화를 만든다
        const raw = window.localStorage.getItem(key);
        if (raw === null) continue;
        try {
          await pushSettingToSupabase(key, JSON.parse(raw));
        } catch {
          // JSON이 아니면(예전 형식) 문자열 그대로 올린다
          await pushSettingToSupabase(key, raw);
        }
      }
    }
    if (changed) dispatchSynced();
  } catch {
    // ignore
  }
}
