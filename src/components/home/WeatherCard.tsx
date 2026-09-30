"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Umbrella } from "lucide-react";
import {
  fetchCurrentWeather,
  fetchRainHoursAhead,
  fetchWeeklyForecast,
  getThemeByCode,
  type DailyForecast,
  type WeatherCurrent,
} from "@/lib/weather";
import { getOrPickDailyWeatherBgUrl, clearDailyWeatherBgCache } from "@/lib/weatherBg";

const WEATHER_OVERLAY_STORAGE_KEY = "weather-bg-overlay-opacity";
const OVERLAY_MIN = 0.05;
const OVERLAY_MAX = 0.5;

function loadOverlayOpacity(): number {
  if (typeof window === "undefined") return 0.1;
  try {
    const v = parseFloat(window.localStorage.getItem(WEATHER_OVERLAY_STORAGE_KEY) ?? "0.1");
    return Number.isFinite(v) ? Math.max(OVERLAY_MIN, Math.min(OVERLAY_MAX, v)) : 0.1;
  } catch {
    return 0.1;
  }
}

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


/** 달력 템플릿 날씨 카드: 날씨별 진한 배경 */
const WEATHER_CARD_COLORS: Record<string, string> = {
  clear: "linear-gradient(160deg,#5AA9E6,#3F86C9)",
  partlyCloudy: "linear-gradient(160deg,#6FAEE0,#4F8FC4)",
  overcast: "linear-gradient(160deg,#8797A8,#66788B)",
  fog: "linear-gradient(160deg,#98A5B0,#7C8B98)",
  rain: "linear-gradient(160deg,#557699,#3B5878)",
  showers: "linear-gradient(160deg,#5F80A0,#45627F)",
  thunderstorm: "linear-gradient(160deg,#6A6486,#4A4568)",
  snow: "linear-gradient(160deg,#A9BFD4,#86A0BA)",
};

/** 의미 단위 두 줄 (말풍선용). 한 줄로 쓸 땐 rainMessage가 공백으로 이어 붙임 */
function rainMessageLines(hoursAhead: number | null | undefined): [string, string] | null {
  if (hoursAhead === undefined) return null;
  if (hoursAhead === null) return ["24시간 안에", "비 소식이 없어요"];
  if (hoursAhead === 0) return ["지금", "비가 오고 있어요"];
  return [`${hoursAhead}시간 후에`, "비가 와요"];
}

/** 비 오는 날씨(비·소나기·뇌우)인 날 */
function isRainDay(code: number): boolean {
  const id = getThemeByCode(code).id;
  return id === "rain" || id === "showers" || id === "thunderstorm";
}

/**
 * 비 오는 요일을 칸에 들어가는 만큼만 앞(가까운 날)에서부터 표시. 잘린 "…" 없이 넘치는 요일은 뺀다.
 * 카드 폭이 바뀌면 다시 전부 넣어 보고 줄임.
 */
function FitDays({ labels, separator, className }: { labels: string[]; separator: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(labels.length);
  const key = labels.join(",");

  useEffect(() => {
    setCount(labels.length);
    const card = ref.current?.closest("section");
    if (!card) return;
    // 이 칸 자체는 글자 수에 따라 폭이 바뀌어서, 폭이 고정된 카드를 지켜봄
    const ro = new ResizeObserver(() => setCount(labels.length));
    ro.observe(card);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const el = ref.current;
    if (el && count > 1 && el.scrollWidth > el.clientWidth) setCount((c) => c - 1);
  });

  return (
    <span ref={ref} className={`min-w-0 overflow-hidden whitespace-nowrap ${className}`}>
      {labels.slice(0, count).join(separator)}
    </span>
  );
}

function rainMessage(hoursAhead: number | null | undefined): string | null {
  return rainMessageLines(hoursAhead)?.join(" ") ?? null;
}

export function WeatherCard({ compact = false }: { compact?: boolean }) {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [customBgFailed, setCustomBgFailed] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(() => loadOverlayOpacity());
  const [overlayMenu, setOverlayMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  /** 카드 안 "이번 주 비 오는 요일"용 예보: 오늘을 빼고 내일부터 7일 */
  const [stripForecast, setStripForecast] = useState<DailyForecast[] | null>(null);
  const [forecastFailed, setForecastFailed] = useState(false);
  const [rainHoursAhead, setRainHoursAhead] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!forecastOpen) return;
    let cancelled = false;
    setForecastFailed(false);
    fetchWeeklyForecast().then((list) => {
      if (cancelled) return;
      if (list) setForecast(list);
      else setForecastFailed(true);
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setForecastOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [forecastOpen]);

  // 작은(달력 템플릿) 카드는 미니 7일 예보를 항상 보여주므로 미리 불러옴
  useEffect(() => {
    if (!compact) return;
    let cancelled = false;
    fetchWeeklyForecast(8).then((list) => {
      if (!cancelled && list) setStripForecast(list.slice(1));
    });
    fetchRainHoursAhead().then((v) => {
      if (!cancelled) setRainHoursAhead(v);
    });
    return () => {
      cancelled = true;
    };
  }, [compact]);

  const applyOverlay = useCallback((value: number) => {
    const clamped = Math.max(OVERLAY_MIN, Math.min(OVERLAY_MAX, value));
    setOverlayOpacity(clamped);
    try {
      window.localStorage.setItem(WEATHER_OVERLAY_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setOverlayMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!overlayMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOverlayMenu(null);
      }
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [overlayMenu]);

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
      const url = getOrPickDailyWeatherBgUrl(themeId);
      setCustomBgUrl(url);
      if (url) setCustomBgFailed(false);
    };
    read();
    const onSettingsChanged = () => {
      clearDailyWeatherBgCache();
      read();
    };
    window.addEventListener("storage", onSettingsChanged);
    window.addEventListener("weather-bg-settings-changed", onSettingsChanged);
    return () => {
      window.removeEventListener("storage", onSettingsChanged);
      window.removeEventListener("weather-bg-settings-changed", onSettingsChanged);
    };
  }, [themeId]);

  const sectionClass = (compact ? "justify-center gap-3 border border-white/20 max-md:flex-row max-md:items-center max-md:justify-between max-md:px-6 max-md:py-5 md:justify-between md:p-6 md:max-xl:p-4 " : "justify-between md:p-9 ") + "weather-card-texture relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl p-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]";
  const blueLayer = (
    <div
      className="absolute inset-0 rounded-3xl"
      style={
        compact
          ? { background: WEATHER_CARD_COLORS[weather?.theme.id ?? "clear"] ?? WEATHER_CARD_COLORS.clear, zIndex: 0 }
          : { backgroundColor: "#5a9fd4", zIndex: 0 }
      }
      aria-hidden
    />
  );

  if (loading) {
    return (
      <section className={sectionClass}>
        {blueLayer}
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-300/60" aria-hidden />
            <div className="mt-3 flex items-baseline gap-3">
              <span className="h-9 w-9 shrink-0 animate-pulse rounded bg-neutral-300/60" aria-hidden />
              <div className="h-12 w-24 animate-pulse rounded bg-neutral-300/60" aria-hidden />
            </div>
            <div className="mt-3 hidden h-5 w-full max-w-[200px] animate-pulse rounded bg-neutral-300/60 sm:block" aria-hidden />
          </div>
        </div>
        <div className="relative z-10 mt-7 hidden flex-wrap gap-3 sm:flex">
          {[1, 2, 3].map((i) => (
            <span key={i} className="h-8 w-20 animate-pulse rounded-full bg-neutral-300/60" aria-hidden />
          ))}
        </div>
      </section>
    );
  }

  if (!weather) {
    return (
      <section className={sectionClass}>
        {blueLayer}
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
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
      </section>
    );
  }

  const useCustomBg = !compact && customBgUrl && !customBgFailed;
  /** 이번 주(내일부터 7일) 비 오는 요일 */
  const rainDayLabels = (stripForecast ?? [])
    .filter((day) => isRainDay(day.weatherCode))
    .map((day) => ["일", "월", "화", "수", "목", "금", "토"][new Date(day.date + "T12:00:00").getDay()]);
  /** 진한 배경(사진 또는 달력 템플릿의 날씨색)이면 흰 글씨 */
  const whiteText = compact || useCustomBg;

  return (
    <section
      className={`${sectionClass} cursor-pointer`}
      onContextMenu={handleContextMenu}
      onClick={() => setForecastOpen(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setForecastOpen(true);
        }
      }}
      title="클릭하면 일주일 예보"
    >
      {!useCustomBg ? blueLayer : null}
      {useCustomBg && (
        <>
          <img
            src={customBgUrl}
            alt=""
            className="hidden"
            onError={() => setCustomBgFailed(true)}
          />
          <div
            className="absolute inset-0 rounded-3xl bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${customBgUrl})`, zIndex: 0 }}
            aria-hidden
          />
          <div
            className="absolute inset-0 rounded-3xl"
            style={{ zIndex: 0, backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
            aria-hidden
          />
        </>
      )}
      <div className={`relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${compact ? "hidden" : ""}`}>
        <div className={`min-w-0 ${whiteText ? "text-white" : ""} ${useCustomBg ? "[text-shadow:0_1px_4px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.8)]" : ""}`}>
          <div className={`${compact ? "hidden" : ""} text-[11px] font-semibold uppercase tracking-[0.18em] ${whiteText ? "text-white/90" : "text-neutral-500"}`}>
            CURRENT WEATHER
          </div>
          <div className={`mt-3 flex items-baseline ${compact ? "gap-2" : "gap-3"}`}>
            <span className={`shrink-0 ${compact ? "text-3xl" : "text-4xl"}`} aria-hidden="true">
              {weather.theme.icon}
            </span>
            <div className={`flex min-w-0 items-baseline ${compact ? "flex-nowrap gap-1.5" : "flex-wrap gap-2"}`}>
              <div className={whiteText ? (compact ? "text-3xl font-semibold tracking-tight text-white" : "text-5xl font-semibold tracking-tight text-white sm:text-6xl") : "text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl"}>
                {weather.temp}°
              </div>
              <div className={whiteText ? (compact ? "whitespace-nowrap text-[15px] text-white/95" : "text-xl text-white/95 sm:text-2xl") : "text-xl text-slate-600 sm:text-2xl"}>
                C · {weatherCodeToLabel(weather.weatherCode)}
              </div>
            </div>
          </div>
          <div className={`mt-3 ${compact ? "hidden" : "hidden sm:block"} text-[15px] md:text-base ${useCustomBg ? "text-white/95" : "text-slate-700"}`} lang="ko">
            {descriptionBySentences(weather.theme.description)}
          </div>
        </div>
      </div>

      <div className={`relative z-10 ${compact ? "" : "mt-7"} ${compact ? "hidden" : "hidden sm:flex"} flex-wrap gap-3 text-sm font-medium ${useCustomBg ? "text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.8)]" : "text-neutral-700"}`}>
        <span className={`rounded-full px-3 py-1 ${useCustomBg ? "bg-white/30 ring-1 ring-white/50" : "bg-white/80 ring-1 ring-soft-border/90"}`}>
          💨{!compact && <span className="hidden md:inline"> 바람</span>} {Number(weather.windSpeed.toFixed(1))} m/s
        </span>
        <span className={`rounded-full px-3 py-1 ${useCustomBg ? "bg-white/30 ring-1 ring-white/50" : "bg-white/80 ring-1 ring-soft-border/90"}`}>
          ☔{!compact && <span className="hidden md:inline"> 강수</span>} {Number(weather.precipitation.toFixed(1))} mm
        </span>
        <span className={`rounded-full px-3 py-1 ${useCustomBg ? "bg-white/30 ring-1 ring-white/50" : "bg-white/80 ring-1 ring-soft-border/90"}`}>
          💧{!compact && <span className="hidden md:inline"> 습도</span>} {weather.humidity}%
        </span>
      </div>

      {/* 폰: 가로로 낮게 — 왼쪽 기온·비 문구, 오른쪽 비 오는 요일 */}
      {compact && (
        <div className="relative z-10 flex min-w-0 flex-col gap-1 md:hidden">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-3xl leading-none" aria-hidden>{weather.theme.icon}</span>
            <span className="text-3xl font-semibold leading-none tracking-tight text-white">
              {weather.temp}
              <span className="text-xl font-medium text-white/80">°C</span>
            </span>
          </div>
          {rainMessage(rainHoursAhead) && (
            <p className="text-[12px] font-semibold leading-snug text-white">{rainMessage(rainHoursAhead)}</p>
          )}
        </div>
      )}

      {compact && stripForecast && (
        <div className="relative z-10 flex min-w-0 max-w-[50%] shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-white md:hidden">
          <Umbrella strokeWidth={1.75} className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="h-4 w-px shrink-0 bg-white/50" aria-hidden />
          {rainDayLabels.length > 0 ? (
            <FitDays labels={rainDayLabels} separator=", " className="text-sm font-bold" />
          ) : (
            <span className="min-w-0 truncate text-sm font-bold">이번 주 비 없음</span>
          )}
        </div>
      )}

      {/* PC 정사각형: 위 = 아이콘 | 기온, 날씨 이름, 비 문구 / 아래 = 구분선 + 이번 주 비 오는 요일 */}
      {compact && (
        <div className="relative z-10 hidden min-w-0 flex-col text-white md:flex">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-6xl leading-none md:max-xl:text-5xl" aria-hidden>{weather.theme.icon}</span>
            <span className="text-6xl font-semibold leading-none tracking-tight md:max-xl:text-5xl">{weather.temp}°</span>
          </div>
          <p className="mt-5 text-xl font-bold md:max-xl:mt-3 md:max-xl:text-lg">{weatherCodeToLabel(weather.weatherCode)}</p>
          {rainMessage(rainHoursAhead) && (
            <p className="mt-1 text-[15px] font-medium text-white/75 md:max-xl:text-sm">{rainMessage(rainHoursAhead)}</p>
          )}
        </div>
      )}

      {compact && stripForecast && (
        <div className="relative z-10 hidden items-center justify-between gap-3 border-t border-white/30 pt-3.5 text-white md:flex md:max-xl:pt-2.5">
          <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-medium text-white/80">
            <Umbrella strokeWidth={1.75} className="h-5 w-5" aria-hidden />
            이번 주 비
          </span>
          {rainDayLabels.length > 0 ? (
            <FitDays labels={rainDayLabels} separator=" · " className="text-right text-base font-bold" />
          ) : (
            <span className="text-base font-bold">없음</span>
          )}
        </div>
      )}

      {forecastOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="일주일 날씨 예보"
            onClick={(e) => {
              e.stopPropagation();
              setForecastOpen(false);
            }}
          >
            <div
              className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl md:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">일주일 날씨</h3>
                <button
                  type="button"
                  onClick={() => setForecastOpen(false)}
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="닫기"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mb-3 text-sm text-neutral-500">
                현재 💨 {Number(weather.windSpeed.toFixed(1))} m/s · ☔ {Number(weather.precipitation.toFixed(1))} mm · 💧 {weather.humidity}%
              </p>
              {forecastFailed ? (
                <p className="py-8 text-center text-sm text-neutral-500">예보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
              ) : !forecast ? (
                <p className="py-8 text-center text-sm text-neutral-400">불러오는 중…</p>
              ) : (
                <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                  {forecast.map((day, i) => {
                    const d = new Date(day.date + "T12:00:00");
                    const label = i === 0 ? "오늘" : i === 1 ? "내일" : ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
                    return (
                      <div
                        key={day.date}
                        className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-3 ${i === 0 ? "bg-sky-50 ring-1 ring-sky-200" : "bg-neutral-50"}`}
                      >
                        <span className="text-sm font-semibold text-neutral-800">{label}</span>
                        <span className="text-xs text-neutral-400">{d.getMonth() + 1}/{d.getDate()}</span>
                        <span className="my-1 text-3xl md:text-4xl" aria-hidden>{day.icon}</span>
                        <span className="text-[11px] text-neutral-500">{weatherCodeToLabel(day.weatherCode)}</span>
                        <span className={`text-xs font-semibold ${day.rainProb >= 30 ? "text-sky-600" : "text-neutral-300"}`}>
                          💧{day.rainProb}%
                        </span>
                        <span className="text-base font-bold text-neutral-900">{day.max}°</span>
                        <span className="text-sm font-medium text-neutral-400">{day.min}°</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {overlayMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[200] flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg"
            style={{
              left: Math.min(overlayMenu.x, document.documentElement.clientWidth - 240),
              top: Math.min(overlayMenu.y, document.documentElement.clientHeight - 120),
            }}
            role="dialog"
            aria-label="날씨 음영 조정"
          >
            <p className="text-sm font-medium text-neutral-800">날씨 박스 음영</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={OVERLAY_MIN * 100}
                max={OVERLAY_MAX * 100}
                step={5}
                value={overlayOpacity * 100}
                onChange={(e) => applyOverlay(Number(e.target.value) / 100)}
                className="h-2 w-32 flex-1 rounded-full bg-neutral-200 accent-neutral-700"
              />
              <span className="w-10 text-right text-sm tabular-nums text-neutral-600">
                {(overlayOpacity * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 15, 20, 25, 30, 40, 50].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyOverlay(p / 100)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    Math.round(overlayOpacity * 100) === p
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </section>
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
