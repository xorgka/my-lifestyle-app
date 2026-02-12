"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchCurrentWeather, type WeatherCurrent } from "@/lib/weather";
import { getRandomWeatherBgUrl } from "@/lib/weatherBg";

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

export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [customBgFailed, setCustomBgFailed] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(() => loadOverlayOpacity());
  const [overlayMenu, setOverlayMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      const url = getRandomWeatherBgUrl(themeId);
      setCustomBgUrl(url);
      if (url) setCustomBgFailed(false);
    };
    read();
    const onCustom = () => read();
    window.addEventListener("storage", read);
    window.addEventListener("visibilitychange", read);
    window.addEventListener("pageshow", read);
    window.addEventListener("focus", read);
    window.addEventListener("weather-bg-settings-changed", onCustom);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("visibilitychange", read);
      window.removeEventListener("pageshow", read);
      window.removeEventListener("focus", read);
      window.removeEventListener("weather-bg-settings-changed", onCustom);
    };
  }, [themeId]);

  const sectionClass = "weather-card-texture relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] md:p-9";
  const blueLayer = (
    <div
      className="absolute inset-0 rounded-3xl"
      style={{ backgroundColor: "#5a9fd4", zIndex: 0 }}
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
            <div className="mt-3 h-5 w-full max-w-[200px] animate-pulse rounded bg-neutral-300/60" aria-hidden />
          </div>
        </div>
        <div className="relative z-10 mt-7 flex flex-wrap gap-3">
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

  const useCustomBg = customBgUrl && !customBgFailed;

  return (
    <section className={sectionClass} onContextMenu={handleContextMenu}>
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
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className={`min-w-0 ${useCustomBg ? "text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.8)]" : ""}`}>
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

      <div className={`relative z-10 mt-7 flex flex-wrap gap-3 text-sm font-medium ${useCustomBg ? "text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.8)]" : "text-neutral-700"}`}>
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

      {overlayMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
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
