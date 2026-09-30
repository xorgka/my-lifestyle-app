"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_DIET_PROFILE,
  DIET_SETTINGS_CHANGED_EVENT,
  type DietDay,
  type DietProfile,
  getDietProfile,
  loadDietDay,
  loadWeightLog,
  todayDateKey,
} from "@/lib/dietDb";
import { calcBmr, calcDailyBase, dailyDeficitTarget, walkKcal } from "@/lib/dietCalc";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";

const fmt = (n: number) => Math.round(n).toLocaleString();

/** 게이지 한 줄: 라벨, 값 / 목표, 막대 */
function Gauge({ label, value, goal, over }: { label: string; value: number; goal: number | null; over?: boolean }) {
  const pct = goal != null && goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <p className="text-xs font-medium text-white/55 md:text-sm">{label}</p>
      <p className="mt-0.5 tabular-nums leading-tight">
        <span className={`text-lg font-bold md:text-3xl ${over ? "text-red-400" : "text-white"}`}>{fmt(value)}</span>
        {goal != null && <span className="ml-1 text-[11px] font-medium text-white/45 md:text-base">/ {fmt(goal)}</span>}
      </p>
      {goal != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15 md:h-2">
          <div className={`h-full rounded-full ${over ? "bg-red-400" : "bg-[#F19E36]"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** 홈 다이어트 카드: 오늘 먹은 양, 오늘 운동, 목표 체중까지 남은 kg. 누르면 다이어트 페이지 */
export function HomeDietCard({ className = "" }: { className?: string }) {
  const [profile, setProfile] = useState<DietProfile>(DEFAULT_DIET_PROFILE);
  const [day, setDay] = useState<DietDay | null>(null);
  const [weightNow, setWeightNow] = useState<number | null>(null);

  const load = useCallback(() => {
    setProfile(getDietProfile());
    const today = todayDateKey();
    loadDietDay(today).then(({ day: d }) => setDay(d));
    loadWeightLog().then((list) => {
      const before = list.filter((w) => w.date <= today);
      setWeightNow(before.length > 0 ? before[before.length - 1].weightKg : null);
    });
  }, []);

  useEffect(() => {
    load();
    // 다이어트 페이지에서 기록하고 돌아오거나 다른 기기 설정이 동기화되면 다시 읽기
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(DIET_SETTINGS_CHANGED_EVENT, load);
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, load);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DIET_SETTINGS_CHANGED_EVENT, load);
      window.removeEventListener(USER_SETTINGS_SYNC_EVENT, load);
    };
  }, [load]);

  const intake = day ? day.meals.reduce((s, m) => s + m.kcal, 0) : 0;
  const exerciseKcal = day ? day.exercises.reduce((s, e) => s + e.kcal, 0) : 0;

  // 다이어트 페이지와 같은 계산: 먹어도 되는 양 = 기본 소모 + 매일 활동 + 운동 − 목표 적자
  const ready = !!(profile.sex && profile.age && profile.heightCm && weightNow);
  const base = ready ? calcDailyBase(calcBmr(profile.sex!, weightNow!, profile.heightCm!, profile.age!)) : null;
  const dailyActivityKcal = weightNow
    ? profile.dailyActivities.reduce((s, a) => s + walkKcal(weightNow, a.speedKmh, a.minutes), 0)
    : 0;
  const allowed = base != null ? base + dailyActivityKcal + exerciseKcal - dailyDeficitTarget(profile.weeklyLossKg) : null;
  const remainKg =
    profile.targetWeightKg != null && weightNow != null ? Math.max(0, weightNow - profile.targetWeightKg) : null;

  return (
    <Link
      href="/diet"
      className={`flex min-h-0 min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-3xl bg-neutral-900 p-3.5 text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] md:gap-3 md:p-6 ${className}`}
    >
      {/* 제목 줄 오른쪽에 목표 체중 (폰·폴드 폭에선 칸이 좁아 잘려서 숨김) */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="shrink-0 text-sm font-bold md:text-base">다이어트</p>
        {remainKg != null && (
          <p className="hidden min-w-0 truncate text-sm font-semibold tabular-nums text-[#FFB25C] xl:block">
            {remainKg > 0 ? `목표 ${profile.targetWeightKg}kg까지 ${remainKg.toFixed(1)}kg` : `목표 ${profile.targetWeightKg}kg 달성`}
          </p>
        )}
      </div>
      <Gauge label="먹은 양" value={intake} goal={allowed != null ? Math.max(0, allowed) : null} over={allowed != null && intake > allowed} />
      <Gauge label="운동" value={exerciseKcal} goal={profile.dailyExerciseGoalKcal > 0 ? profile.dailyExerciseGoalKcal : null} />
    </Link>
  );
}
