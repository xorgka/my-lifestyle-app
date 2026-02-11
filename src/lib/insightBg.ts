/**
 * 투데이 인사이트 카드 배경 설정
 * Supabase 연결 시 기기/브라우저 동기화, 없으면 localStorage만 사용
 * - auto / single / list 모드
 */

import { supabase } from "./supabase";

const INSIGHT_BG_SETTINGS_KEY = "insight-bg-settings";
const INSIGHT_BG_URL_KEY = "insight-bg-url"; // 이전 버전 호환
const INSIGHT_BG_LIST_INDEX_KEY = "insight-bg-list-index"; // list 모드에서 더블클릭 시 순환용 인덱스 (기기별 유지)
const SUPABASE_ROW_ID = "default";

export type InsightBgMode = "auto" | "single" | "list";

/** 저장/반환 타입. mode가 auto여도 이전 single/list 값은 보존됨(자동 전환 시 URL 안 사라짐) */
export type InsightBgSettings =
  | { mode: "auto"; url?: string; urls?: string[] }
  | { mode: "single"; url: string; urls?: string[] }
  | { mode: "list"; urls: string[]; url?: string };

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(INSIGHT_BG_SETTINGS_KEY);
  } catch {
    return null;
  }
}

function writeRaw(json: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INSIGHT_BG_SETTINGS_KEY, json);
  } catch {}
}

/** single/list에 실제 URL이 있으면 true. auto만 있으면 덮어쓰지 않기 위함 */
function hasMeaningfulInsightBg(ib: Record<string, unknown>): boolean {
  if (!ib || typeof ib !== "object") return false;
  const mode = ib.mode as string | undefined;
  if (mode === "single" && typeof ib.url === "string" && ib.url.trim() !== "") return true;
  if (mode === "list" && Array.isArray(ib.urls) && ib.urls.some((u) => typeof u === "string" && (u as string).trim() !== "")) return true;
  return false;
}

/** Supabase에서 인사이트 배경 설정을 가져와 localStorage에 반영. single/list URL이 있을 때만 덮어쓰고, 로컬에만 있으면 DB로 올림 */
export async function syncInsightBgFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: row, error } = await supabase
      .from("user_display_settings")
      .select("insight_bg")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle();
    if (error || !row || !row.insight_bg) return;
    const ib = row.insight_bg as Record<string, unknown>;
    if (hasMeaningfulInsightBg(ib)) {
      writeRaw(JSON.stringify(ib));
    } else {
      const local = getInsightBgSettings();
      const st: Stored =
        local.mode === "single" && "url" in local
          ? { mode: "single", url: local.url }
          : local.mode === "list" && "urls" in local
            ? { mode: "list", urls: local.urls }
            : { mode: local.mode ?? "auto", url: "url" in local ? local.url : undefined, urls: "urls" in local ? local.urls : undefined };
      if (st.mode === "single" && st.url?.trim()) saveInsightBgToSupabase(st);
      else if (st.mode === "list" && st.urls?.length) saveInsightBgToSupabase(st);
    }
  } catch {
    // ignore
  }
}

async function saveInsightBgToSupabase(settings: Stored): Promise<void> {
  if (!supabase) return;
  try {
    const { data: row } = await supabase
      .from("user_display_settings")
      .select("weather_bg")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle();
    const weatherBg = (row?.weather_bg ?? {}) as Record<string, unknown>;
    await supabase
      .from("user_display_settings")
      .upsert(
        { id: SUPABASE_ROW_ID, weather_bg: weatherBg, insight_bg: settings, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
  } catch {
    // ignore
  }
}

/** 이전 단일 URL 키가 있으면 single 모드로 변환 */
function migrateFromLegacy(): InsightBgSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const url = window.localStorage.getItem(INSIGHT_BG_URL_KEY);
    if (url && url.trim()) {
      window.localStorage.removeItem(INSIGHT_BG_URL_KEY);
      return { mode: "single", url: url.trim() };
    }
  } catch {
    // ignore
  }
  return null;
}

/** 저장된 전체 객체 (mode + url/urls 보존용) */
type Stored = { mode: InsightBgMode; url?: string; urls?: string[] };

export function getInsightBgSettings(): InsightBgSettings {
  const raw = readRaw();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Stored;
      if (!parsed || typeof parsed.mode !== "string") return { mode: "auto" };
      if (parsed.mode === "auto") return { mode: "auto", url: parsed.url, urls: parsed.urls };
      if (parsed.mode === "single" && typeof parsed.url === "string" && parsed.url.trim())
        return { mode: "single", url: parsed.url.trim(), urls: parsed.urls };
      if (parsed.mode === "list" && Array.isArray(parsed.urls)) {
        const urls = parsed.urls.filter((u): u is string => typeof u === "string" && u.trim() !== "").map((u) => u.trim());
        if (urls.length > 0) return { mode: "list", urls, url: parsed.url };
      }
    } catch {
      // fall through
    }
  }
  const legacy = migrateFromLegacy();
  if (legacy) return legacy;
  return { mode: "auto" };
}

export function setInsightBgSettings(settings: Partial<InsightBgSettings> | InsightBgSettings): void {
  if (typeof window === "undefined") return;
  try {
    if (settings.mode === "auto" && Object.keys(settings).length <= 1) {
      const current = getInsightBgSettings();
      const merged: Stored = {
        mode: "auto",
        url: "url" in current ? current.url : undefined,
        urls: "urls" in current ? current.urls : undefined,
      };
      window.localStorage.setItem(INSIGHT_BG_SETTINGS_KEY, JSON.stringify(merged));
      saveInsightBgToSupabase(merged);
      return;
    }
    const toSave: Stored =
      settings.mode === "single" && "url" in settings
        ? { mode: "single", url: settings.url }
        : settings.mode === "list" && "urls" in settings
          ? { mode: "list", urls: settings.urls }
          : { mode: settings.mode ?? "auto" };
    window.localStorage.setItem(INSIGHT_BG_SETTINGS_KEY, JSON.stringify(toSave));
    saveInsightBgToSupabase(toSave);
  } catch {
    // ignore
  }
}

/** list 모드에서 더블클릭으로 넘길 때 쓰는 인덱스 (localStorage) */
export function getInsightBgListIndex(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(INSIGHT_BG_LIST_INDEX_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setInsightBgListIndex(index: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INSIGHT_BG_LIST_INDEX_KEY, String(index));
  } catch {
    // ignore
  }
}

/** 현재 표시할 이미지 URL. null이면 Picsum 사용. list 모드는 저장된 인덱스로 순환 */
export function getInsightBgDisplayUrl(): string | null {
  const settings = getInsightBgSettings();
  if (settings.mode === "auto") return null;
  if (settings.mode === "single") return settings.url;
  const { urls } = settings;
  if (urls.length === 0) return null;
  const index = getInsightBgListIndex() % urls.length;
  return urls[index] ?? null;
}

// 이전 API 호환 (single일 때만 사용하는 코드 대비)
export function getInsightBgUrl(): string | null {
  const s = getInsightBgSettings();
  return s.mode === "single" ? s.url : null;
}

export function clearInsightBgUrl(): void {
  setInsightBgSettings({ mode: "auto" });
}
