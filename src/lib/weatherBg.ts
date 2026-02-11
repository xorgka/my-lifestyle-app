/**
 * 날씨 박스 배경: 날씨별 이미지 URL 목록 (localStorage)
 * 테마당 여러 URL 등록 가능, 표시 시 그중 하나 랜덤 선택
 * - 새로고침/탭 전환 후에도 유지됨
 * - 기기 간 동기화를 원하면 Supabase user_settings 등에 저장하도록 연동 가능
 */

import type { WeatherThemeId } from "@/lib/weather";

const WEATHER_BG_SETTINGS_KEY = "weather-bg-settings";

export type WeatherBgSettings = Partial<Record<WeatherThemeId, string[]>>;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WEATHER_BG_SETTINGS_KEY);
  } catch {
    /* 시크릿/일부 환경에서 localStorage 접근 불가 */
    return null;
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
    window.localStorage.setItem(WEATHER_BG_SETTINGS_KEY, JSON.stringify(settings));
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
