/**
 * 날씨 박스 배경: 날씨별 이미지 URL 목록
 * Supabase 연결 시 기기/브라우저 동기화, 없으면 localStorage만 사용
 */

import type { WeatherThemeId } from "@/lib/weather";
import { supabase } from "./supabase";

const WEATHER_BG_SETTINGS_KEY = "weather-bg-settings";
const SUPABASE_ROW_ID = "default";

export type WeatherBgSettings = Partial<Record<WeatherThemeId, string[]>>;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WEATHER_BG_SETTINGS_KEY);
  } catch {
    return null;
  }
}

function writeRaw(json: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEATHER_BG_SETTINGS_KEY, json);
  } catch {}
}

/** DB에 URL이 하나라도 있으면 true (빈 객체면 덮어쓰지 않기 위함) */
function hasAnyWeatherUrls(w: Record<string, unknown>): boolean {
  if (!w || typeof w !== "object") return false;
  for (const v of Object.values(w)) {
    if (Array.isArray(v) && v.some((u) => typeof u === "string" && (u as string).trim() !== "")) return true;
  }
  return false;
}

/** Supabase에서 날씨 배경 설정을 가져와 localStorage에 반영. 빈 설정이면 덮어쓰지 않고, 로컬에만 있으면 DB로 올림 */
export async function syncWeatherBgFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: row, error } = await supabase
      .from("user_display_settings")
      .select("weather_bg")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle();
    if (error || !row || !row.weather_bg) return;
    const w = row.weather_bg as Record<string, unknown>;
    if (hasAnyWeatherUrls(w)) {
      writeRaw(JSON.stringify(w));
    } else {
      const local = getWeatherBgSettings();
      if (Object.keys(local).length > 0) saveWeatherBgToSupabase(local);
    }
  } catch {
    // ignore
  }
}

async function saveWeatherBgToSupabase(settings: WeatherBgSettings): Promise<void> {
  if (!supabase) return;
  try {
    const { data: row } = await supabase
      .from("user_display_settings")
      .select("insight_bg")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle();
    const insightBg = (row?.insight_bg ?? { mode: "auto" }) as Record<string, unknown>;
    await supabase
      .from("user_display_settings")
      .upsert(
        { id: SUPABASE_ROW_ID, weather_bg: settings, insight_bg: insightBg, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
  } catch {
    // ignore
  }
}

export function getWeatherBgSettings(): WeatherBgSettings {
  const raw = readRaw();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const result: WeatherBgSettings = {};
    const themeIds: WeatherThemeId[] = [
      "clear", "partlyCloudy", "fog", "rain", "snow", "showers", "thunderstorm", "overcast",
    ];
    for (const id of themeIds) {
      const arr = parsed[id];
      if (Array.isArray(arr)) {
        const urls = arr.filter((u): u is string => typeof u === "string" && u.trim() !== "").map((u) => (u as string).trim());
        if (urls.length > 0) result[id] = urls;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function setWeatherBgSettings(settings: WeatherBgSettings): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(settings);
    window.localStorage.setItem(WEATHER_BG_SETTINGS_KEY, json);
    saveWeatherBgToSupabase(settings);
  } catch {
    // ignore
  }
}

export function getWeatherBgUrls(themeId: WeatherThemeId): string[] {
  const settings = getWeatherBgSettings();
  return settings[themeId] ?? [];
}

/** 해당 테마에 등록된 URL이 있으면 그중 하나 랜덤 반환, 없으면 null */
export function getRandomWeatherBgUrl(themeId: WeatherThemeId): string | null {
  const urls = getWeatherBgUrls(themeId);
  if (urls.length === 0) return null;
  return urls[Math.floor(Math.random() * urls.length)] ?? null;
}
