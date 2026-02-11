"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { getInsightBgDisplayUrl, setInsightBgSettings } from "@/lib/insightBg";
import { TodayInsightHero } from "./TodayInsightHero";

/** 12시간 단위 시드: 0~11시 = 0, 12~23시 = 1 → 하루 2번 이미지 교체 */
function getTwiceDailySeed(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const period = d.getHours() < 12 ? 0 : 1;
  return `insight-${y}-${m}-${day}-${period}`;
}

/** 다음 12시간 경계까지 ms (정각 0시 또는 12시) */
function msUntilNextPeriod(): number {
  const now = new Date();
  const hour = now.getHours();
  const next = hour < 12 ? new Date(now) : new Date(now);
  if (hour < 12) {
    next.setHours(12, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

const PICSUM_SIZE = 800;

export function InsightPhotoCard() {
  const [seed, setSeed] = useState(() => getTwiceDailySeed());
  const [nextPhotoCount, setNextPhotoCount] = useState(0);
  const [customUrl, setCustomUrl] = useState<string | null>(() => getInsightBgDisplayUrl());
  const [customUrlFailed, setCustomUrlFailed] = useState(false);

  useEffect(() => {
    setCustomUrl(getInsightBgDisplayUrl());
    setCustomUrlFailed(false);
  }, []);

  useEffect(() => {
    const reRead = () => {
      const next = getInsightBgDisplayUrl();
      setCustomUrl(next);
      if (next) setCustomUrlFailed(false);
    };
    window.addEventListener("storage", reRead);
    window.addEventListener("visibilitychange", reRead);
    window.addEventListener("pageshow", reRead);
    window.addEventListener("focus", reRead);
    return () => {
      window.removeEventListener("storage", reRead);
      window.removeEventListener("visibilitychange", reRead);
      window.removeEventListener("pageshow", reRead);
      window.removeEventListener("focus", reRead);
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSeed(getTwiceDailySeed());
    }, msUntilNextPeriod());
    return () => clearTimeout(timeout);
  }, [seed]);

  useEffect(() => {
    if (!customUrl || customUrlFailed) return;
    const timeout = setTimeout(() => {
      setCustomUrl(getInsightBgDisplayUrl());
    }, msUntilNextPeriod());
    return () => clearTimeout(timeout);
  }, [customUrl, customUrlFailed]);

  const picsumSeed = nextPhotoCount === 0 ? seed : `insight-next-${nextPhotoCount}`;
  const picsumUrl = useMemo(
    () => `https://picsum.photos/seed/${picsumSeed}/${PICSUM_SIZE}/${PICSUM_SIZE}`,
    [picsumSeed]
  );
  const displayUrl = (customUrl && !customUrlFailed) ? customUrl : picsumUrl;

  const goNextPhoto = () => {
    if (customUrl && !customUrlFailed) {
      setInsightBgSettings({ mode: "auto" });
      setCustomUrl(null);
      setCustomUrlFailed(false);
    }
    setNextPhotoCount((c) => c + 1);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const glass = (e.currentTarget as HTMLElement).querySelector("[data-insight-glass]");
    if (glass && glass.contains(e.target as Node)) return;
    goNextPhoto();
  };

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 overflow-hidden rounded-3xl bg-neutral-200"
      onDoubleClick={handleDoubleClick}
      title="배경 더블클릭 시 다음 사진"
    >
      {customUrl && !customUrlFailed && (
        <img
          src={customUrl}
          alt=""
          className="hidden"
          onError={() => setCustomUrlFailed(true)}
        />
      )}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${displayUrl})` }}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4 sm:p-5">
        <div
          className="insight-glass relative flex min-h-0 max-h-full w-full max-w-[300px] flex-col rounded-2xl border border-white/30 px-5 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:min-h-[320px] sm:max-w-[340px] sm:px-5 sm:py-5 [background:rgba(0,0,0,0.11)]"
          data-insight-glass
        >
          <TodayInsightHero
            title={
              <Link
                href="/insight?tab=system"
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-white no-underline hover:text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.5),0_0_10px_rgba(0,0,0,0.4)]"
                aria-label="문장 관리 페이지로 이동"
              >
                TODAY&apos;S INSIGHT
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
