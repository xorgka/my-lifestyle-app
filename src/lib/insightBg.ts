/**
 * 투데이 인사이트 카드 배경 설정 (localStorage)
 * - auto: Picsum 자동 (12시간마다)
 * - single: URL 1개 고정
 * - list: 여러 URL 목록, 12시간마다 순환
 */

const INSIGHT_BG_SETTINGS_KEY = "insight-bg-settings";
const INSIGHT_BG_URL_KEY = "insight-bg-url"; // 이전 버전 호환

export type InsightBgMode = "auto" | "single" | "list";

export type InsightBgSettings =
  | { mode: "auto" }
  | { mode: "single"; url: string }
  | { mode: "list"; urls: string[] };

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(INSIGHT_BG_SETTINGS_KEY);
  } catch {
    return null;
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

export function getInsightBgSettings(): InsightBgSettings {
  const raw = readRaw();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as InsightBgSettings;
      if (parsed.mode === "auto") return { mode: "auto" };
      if (parsed.mode === "single" && typeof parsed.url === "string" && parsed.url.trim())
        return { mode: "single", url: parsed.url.trim() };
      if (parsed.mode === "list" && Array.isArray(parsed.urls)) {
        const urls = parsed.urls.filter((u): u is string => typeof u === "string" && u.trim() !== "").map((u) => u.trim());
        if (urls.length > 0) return { mode: "list", urls };
      }
    } catch {
      // fall through
    }
  }
  const legacy = migrateFromLegacy();
  if (legacy) return legacy;
  return { mode: "auto" };
}

export function setInsightBgSettings(settings: InsightBgSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INSIGHT_BG_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/** 12시간마다 증가하는 슬롯 인덱스 (0시·12시 경계) */
function getSlotIndex(): number {
  return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

/** 현재 표시할 이미지 URL. null이면 Picsum 사용 */
export function getInsightBgDisplayUrl(): string | null {
  const settings = getInsightBgSettings();
  if (settings.mode === "auto") return null;
  if (settings.mode === "single") return settings.url;
  const { urls } = settings;
  if (urls.length === 0) return null;
  const index = getSlotIndex() % urls.length;
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
