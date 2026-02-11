"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchCurrentWeather, type WeatherCurrent, type WeatherThemeId } from "@/lib/weather";

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

/** 날씨 테마별 그라데이션·그림자 (Tailwind 전체 클래스명으로 유지) */
const THEME_CLASSES: Record<
  WeatherThemeId,
  { gradient: string; shadow: string }
> = {
  clear: {
    gradient: "from-white via-blue-50/95 to-sky-300/80",
    shadow: "shadow-[0_2px_12px_rgba(14,116,144,0.08)]",
  },
  partlyCloudy: {
    gradient: "from-white via-sky-100/90 to-slate-300/70",
    shadow: "shadow-[0_2px_12px_rgba(100,116,139,0.1)]",
  },
  fog: {
    gradient: "from-white via-slate-100/90 to-slate-400/60",
    shadow: "shadow-[0_2px_12px_rgba(71,85,105,0.12)]",
  },
  rain: {
    gradient: "from-slate-50 via-sky-200/80 to-slate-400/70",
    shadow: "shadow-[0_2px_12px_rgba(30,58,138,0.15)]",
  },
  snow: {
    gradient: "from-white via-sky-100/95 to-sky-400/70",
    shadow: "shadow-[0_2px_12px_rgba(56,189,248,0.12)]",
  },
  showers: {
    gradient: "from-sky-50 via-blue-200/85 to-slate-500/60",
    shadow: "shadow-[0_2px_12px_rgba(30,64,175,0.12)]",
  },
  thunderstorm: {
    gradient: "from-slate-100 via-slate-300/90 to-slate-600/70",
    shadow: "shadow-[0_2px_14px_rgba(30,41,59,0.2)]",
  },
  overcast: {
    gradient: "from-slate-50 via-sky-200/80 to-slate-400/70",
    shadow: "shadow-[0_2px_12px_rgba(100,116,139,0.1)]",
  },
};

export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <Card className="weather-card-texture flex h-full min-h-0 flex-col justify-between rounded-3xl bg-gradient-to-br from-white via-blue-50/95 to-sky-300/80 p-5 shadow-[0_2px_12px_rgba(14,116,144,0.08)] md:p-9">
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
      <Card className="weather-card-texture flex h-full min-h-0 flex-col justify-between rounded-3xl bg-gradient-to-br from-white via-blue-50/95 to-sky-300/80 p-5 shadow-[0_2px_12px_rgba(14,116,144,0.08)] md:p-9">
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

  const { gradient, shadow } = THEME_CLASSES[weather.theme.id];

  return (
    <Card
      className={`weather-card-texture flex h-full min-h-0 flex-col justify-between rounded-3xl bg-gradient-to-br p-5 md:p-9 ${gradient} ${shadow}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            CURRENT WEATHER
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-4xl shrink-0" aria-hidden="true">
              {weather.theme.icon}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <div className="text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
                {weather.temp}°
              </div>
              <div className="text-xl text-neutral-500 sm:text-2xl">
                C · {weatherCodeToLabel(weather.weatherCode)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-base text-neutral-600" lang="ko">
            {descriptionBySentences(weather.theme.description)}
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-3 text-sm font-medium text-neutral-700">
        <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-soft-border/90">
          🍃<span className="hidden md:inline"> 바람</span> {Number(weather.windSpeed.toFixed(1))} m/s
        </span>
        <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-soft-border/90">
          ☔<span className="hidden md:inline"> 강수</span> {Number(weather.precipitation.toFixed(1))} mm
        </span>
        <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-soft-border/90">
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
