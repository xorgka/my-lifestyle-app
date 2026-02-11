"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchCurrentWeather, type WeatherCurrent, type WeatherThemeId } from "@/lib/weather";
import { getRandomWeatherBgUrl } from "@/lib/weatherBg";

/** 2문장 이상이면 문장 단위로 나누어 줄바꿈 (마침표+공백 기준) */
function descriptionBySentences(description: string): React.ReactNode {
  const sentences = description.split(/\.\s+/).filter(Boolean);
  if (sentences.length <= 1) return description;
  const endsWithDot = description.trimEnd().endsWith(".");
  return (
    <>
      {sentences.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {s}
          {i < sentences.length - 1 ? "." : endsWithDot ? "." : ""}
        </React.Fragment>
      ))}
    </>
  );
}

/** 스카이 블루 단색 (날씨 박스) */
const WEATHER_SKY_BG = "bg-[#5a9fd4]";
const WEATHER_SKY_SHADOW = "shadow-[0_4px_14px_rgba(0,0,0,0.08)]";

/** 날씨 테마별 배경·그림자 (통일 스카이 블루) */
const THEME_CLASSES: Record<
  WeatherThemeId,
  { bg: string; shadow: string }
> = {
  clear: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  partlyCloudy: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  fog: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  rain: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  snow: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  showers: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  thunderstorm: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
  overcast: { bg: WEATHER_SKY_BG, shadow: WEATHER_SKY_SHADOW },
};

export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [customBgFailed, setCustomBgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCurrentWeather()
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const themeId = weather?.theme.id;

  useEffect(() => {
    if (!themeId) return;
    const read = () => {
      const url = getRandomWeatherBgUrl(themeId);
      setCustomBgUrl(url);
      if (url) setCustomBgFailed(false);
    };
    read();
    const onCustom = () => read();
    window.addEventListener("storage", read);
    window.addEventListener("visibilitychange", read);
    window.addEventListener("pageshow", read);
    window.addEventListener("weather-bg-settings-changed", onCustom);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("visibilitychange", read);
      window.removeEventListener("pageshow", read);
      window.removeEventListener("weather-bg-settings-changed", onCustom);
    };
  }, [themeId]);

  if (loading) {
    return (
      <Card className={`weather-card-texture flex h-full min-h-0 flex-col justify-between rounded-3xl ${WEATHER_SKY_BG} p-5 ${WEATHER_SKY_SHADOW} md:p-9`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-300/60" aria-hidden />
            <div className="mt-3 flex items-baseline gap-3">
              <span className="h-9 w-9 shrink-0 animate-pulse rounded bg-neutral-300/60" aria-hidden />
              <div className="h-12 w-24 animate-pulse rounded bg-neutral-300/60" aria-hidden />
            </div>
            <div className="mt-3 h-5 w-full max-w-[200px] animate-pulse rounded bg-neutral-300/60" aria-hidden />
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          {[1, 2, 3].map((i) => (
            <span key={i} className="h-8 w-20 animate-pulse rounded-full bg-neutral-300/60" aria-hidden />
          ))}
        </div>
      </Card>
    );
  }

  if (!weather) {
    return (
      <Card className={`weather-card-texture flex h-full min-h-0 flex-col justify-between rounded-3xl ${WEATHER_SKY_BG} p-5 ${WEATHER_SKY_SHADOW} md:p-9`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              CURRENT WEATHER
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl shrink-0" aria-hidden="true">
                ☀️
              </span>
              <div className="text-2xl text-neutral-500">—</div>
            </div>
            <div className="mt-3 text-base text-neutral-600">
              날씨를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const { bg, shadow } = THEME_CLASSES[weather.theme.id];
  const useCustomBg = customBgUrl && !customBgFailed;

  return (
    <Card
      className={`weather-card-texture relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-3xl p-5 md:p-9 ${useCustomBg ? "bg-neutral-300" : bg} ${shadow}`}
    >
      {useCustomBg && (
        <>
          <img
            src={customBgUrl}
            alt=""
            className="hidden"
            onError={() => setCustomBgFailed(true)}
          />
          <div
            className="absolute inset-0 bg-cover bg-center rounded-3xl"
            style={{ backgroundImage: `url(${customBgUrl})` }}
            aria-hidden
          />
          <div className="absolute inset-0 rounded-3xl bg-black/25" aria-hidden />
        </>
      )}
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className={`min-w-0 ${useCustomBg ? "text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]" : ""}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${useCustomBg ? "text-white/90" : "text-neutral-500"}`}>
            CURRENT WEATHER
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-4xl shrink-0" aria-hidden="true">
              {weather.theme.icon}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <div className={useCustomBg ? "text-5xl font-semibold tracking-tight text-white sm:text-6xl" : "text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl"}>
                {weather.temp}°
              </div>
              <div className={useCustomBg ? "text-xl text-white/95 sm:text-2xl" : "text-xl text-slate-600 sm:text-2xl"}>
                C · {weatherCodeToLabel(weather.weatherCode)}
              </div>
            </div>
          </div>
          <div className={`mt-3 text-[15px] md:text-base ${useCustomBg ? "text-white/95" : "text-slate-700"}`} lang="ko">
            {descriptionBySentences(weather.theme.description)}
          </div>
        </div>
      </div>

      <div className={`relative z-10 mt-7 flex flex-wrap gap-3 text-sm font-medium ${useCustomBg ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]" : "text-neutral-700"}`}>
        <span className={`rounded-full px-3 py-1 ${useCustomBg ? "bg-white/30 ring-1 ring-white/50" : "bg-white/80 ring-1 ring-soft-border/90"}`}>
          🍃<span className="hidden md:inline"> 바람</span> {Number(weather.windSpeed.toFixed(1))} m/s
        </span>
        <span className={`rounded-full px-3 py-1 ${useCustomBg ? "bg-white/30 ring-1 ring-white/50" : "bg-white/80 ring-1 ring-soft-border/90"}`}>
          ☔<span className="hidden md:inline"> 강수</span> {Number(weather.precipitation.toFixed(1))} mm
        </span>
        <span className={`rounded-full px-3 py-1 ${useCustomBg ? "bg-white/30 ring-1 ring-white/50" : "bg-white/80 ring-1 ring-soft-border/90"}`}>
          💧<span className="hidden md:inline"> 습도</span> {weather.humidity}%
        </span>
      </div>
    </Card>
  );
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return "맑음";
  if (code >= 1 && code <= 2) return "대체로 맑음";
  if (code === 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if (code >= 51 && code <= 67) return "비";
  if (code >= 71 && code <= 77) return "눈";
  if (code >= 80 && code <= 82) return "소나기";
  if (code >= 95 && code <= 99) return "뇌우";
  return "흐림";
}
