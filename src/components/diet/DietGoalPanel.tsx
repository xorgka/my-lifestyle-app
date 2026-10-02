"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { KCAL_PER_KG } from "@/lib/dietCalc";
import { formatChange, useChangeUnit } from "@/components/diet/useChangeUnit";

const fmt = (n: number) => Math.round(n).toLocaleString();

function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 다이어트 목표 패널: 목표 체중 게이지, 예상 달성일, 번갈아 나오는 문구.
 */
export function DietGoalPanel({
  targetWeightKg,
  weeklyLossKg,
  startWeightKg,
  currentWeightKg,
  dayLabel,
  dayIsPast,
  dayExerciseKcal,
  dayAchieved,
  exerciseGoalKcal,
  actualDailyDeficit,
  paceDayCount,
  totalChange,
  treadmillMinutesFor,
  treadmillLabel,
  onOpenSettings,
}: {
  targetWeightKg: number | null;
  weeklyLossKg: number;
  /** 처음 기록한 몸무게 */
  startWeightKg: number | null;
  currentWeightKg: number | null;
  /** 운동 칸이 보여주는 날짜: 오늘이면 "오늘", 아니면 "9월 30일" */
  dayLabel: string;
  /** 보고 있는 날짜가 오늘보다 전 */
  dayIsPast: boolean;
  /** 보고 있는 날짜의 운동 칼로리 */
  dayExerciseKcal: number;
  dayAchieved: boolean;
  exerciseGoalKcal: number;
  /** 최근 실제 기록의 하루 평균 적자(kcal, +면 빠지는 중). 기록한 날이 3일 미만이면 null */
  actualDailyDeficit: number | null;
  /** 평균에 쓴 날 수 */
  paceDayCount: number;
  /** 기록 시작일부터 지금까지 쌓인 칼로리(먹은 양 − 쓴 칼로리, +면 찌는 쪽)와, 계획대로였을 때의 값. 기록이 없으면 null */
  totalChange: { sinceLabel: string; kcal: number; planKcal: number } | null;
  /** kcal → 설정한 트레드밀로 몇 분. 몸무게를 모르면 null */
  treadmillMinutesFor: (kcal: number) => number | null;
  treadmillLabel: string;
  onOpenSettings: () => void;
}) {
  const hasGoal = targetWeightKg != null && currentWeightKg != null;
  const remainKg = hasGoal ? Math.max(0, currentWeightKg! - targetWeightKg!) : 0;
  // 예상 달성일: 실제 기록(먹은 양·운동·소모)이 3일 이상 있으면 그 페이스로, 없으면 설정한 주당 감량 목표로
  const usePace = actualDailyDeficit != null;
  const paceStalled = usePace && actualDailyDeficit! <= 0;
  const etaDays = usePace
    ? paceStalled
      ? null
      : Math.ceil((remainKg * KCAL_PER_KG) / actualDailyDeficit!)
    : hasGoal && weeklyLossKg > 0
      ? Math.ceil(remainKg / weeklyLossKg) * 7
      : 0;
  const eta = new Date();
  eta.setDate(eta.getDate() + (etaDays ?? 0));
  const start = startWeightKg ?? currentWeightKg;
  const totalKg = hasGoal && start != null ? start - targetWeightKg! : 0;
  const lostKg = hasGoal && start != null ? start - currentWeightKg! : 0;
  const progressPct = totalKg > 0 ? Math.min(100, Math.max(0, (lostKg / totalKg) * 100)) : 0;

  const exerciseLeft = Math.max(0, exerciseGoalKcal - dayExerciseKcal);
  const leftMinutes = treadmillMinutesFor(exerciseLeft);

  // 번갈아 보여줄 문구
  const messages: string[] = [];
  if (hasGoal && remainKg > 0)
    messages.push(
      !usePace
        ? `목표 ${targetWeightKg}kg까지 ${remainKg.toFixed(1)}kg — 주 ${weeklyLossKg}kg씩이면 ${dateLabel(eta)}에 도착해요`
        : paceStalled
          ? `최근 ${paceDayCount}일은 하루 평균 ${fmt(-actualDailyDeficit!)}kcal 더 먹었어요 — 이 페이스면 안 빠져요`
          : `최근 ${paceDayCount}일 하루 평균 ${fmt(actualDailyDeficit!)}kcal 적자 — 이 페이스면 ${dateLabel(eta)}에 도착해요`
    );
  if (hasGoal && remainKg === 0) messages.push(`목표 ${targetWeightKg}kg 달성! 이제 유지가 목표예요`);
  if (hasGoal && lostKg > 0) messages.push(`시작 ${start}kg에서 ${lostKg.toFixed(1)}kg 뺐어요. 목표의 ${Math.round(progressPct)}%까지 왔어요`);
  if (dayAchieved) messages.push(`${dayLabel} 운동 목표 달성! ${fmt(dayExerciseKcal)}kcal 태웠어요`);
  else if (exerciseGoalKcal > 0)
    messages.push(
      dayIsPast
        ? `${dayLabel} 운동은 목표보다 ${fmt(exerciseLeft)}kcal 모자랐어요`
        : leftMinutes != null
          ? `${dayLabel} 운동 ${fmt(exerciseLeft)}kcal 남았어요 — ${treadmillLabel} ${Math.ceil(leftMinutes)}분이면 채워요`
          : `${dayLabel} 운동 ${fmt(exerciseLeft)}kcal 남았어요`
    );

  const [changeUnit, toggleChangeUnit] = useChangeUnit();
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex((i) => i + 1);
        setVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(id);
  }, []);
  const message = messages[msgIndex % messages.length];

  return (
    <section className="relative rounded-3xl bg-neutral-900 p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] md:p-7">
      {hasGoal ? (
        <>
          {/* 폰: 예상 달성일만 오른쪽 위에 (계산 기준 설명은 생략) */}
          {remainKg > 0 && (
            <p className="absolute right-5 top-5 text-sm tabular-nums text-white/60 md:hidden">
              예상 달성 <b className="text-base text-white">{paceStalled ? "—" : dateLabel(eta)}</b>
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                <Target className="h-4 w-4" aria-hidden />
                목표 체중
              </p>
              <p className="mt-1.5 tabular-nums">
                <span className="text-4xl font-bold md:text-5xl">{targetWeightKg}kg</span>
                <span className="ml-2 text-lg font-semibold text-[#FFB25C] md:text-xl">
                  {remainKg > 0 ? `${remainKg.toFixed(1)}kg 남음` : "달성!"}
                </span>
              </p>
            </div>
            {remainKg > 0 && (
              <p className="hidden text-right text-sm tabular-nums text-white/60 md:block">
                예상 달성 <b className="text-base text-white">{paceStalled ? "—" : dateLabel(eta)}</b>
                <br />
                {!usePace
                  ? `주 ${weeklyLossKg}kg씩 가정 · 기록 3일부터 실제로 계산`
                  : paceStalled
                    ? `최근 ${paceDayCount}일 하루 평균 ${fmt(-actualDailyDeficit!)}kcal 초과`
                    : `최근 ${paceDayCount}일 하루 평균 ${fmt(actualDailyDeficit!)}kcal 적자`}
              </p>
            )}
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#F19E36] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs tabular-nums text-white/50">
            <span>시작 {start}kg</span>
            <span className="text-white/80">지금 {currentWeightKg}kg</span>
            <span>목표 {targetWeightKg}kg</span>
          </div>
          {/* 기록 시작일부터 쌓인 칼로리: 0이면 제자리, 계획 값이면 목표대로 */}
          {totalChange && (
            // 누르면 kcal ↔ kg (지방 1kg = 7,700kcal)
            <button
              type="button"
              onClick={toggleChangeUnit}
              title={changeUnit === "kg" ? "누르면 kcal로 보기" : "누르면 kg으로 보기"}
              className="mt-4 flex flex-wrap items-baseline gap-x-2 text-left text-sm tabular-nums text-white/60 md:text-[15px]"
            >
              <span>{totalChange.sinceLabel}부터 누적</span>
              <b className={`text-lg md:text-xl ${totalChange.kcal > 0 ? "text-red-300" : "text-emerald-300"}`}>
                {formatChange(totalChange.kcal, changeUnit)}
                {changeUnit}
              </b>
              <span>
                {/* 폰에서는 이 부분이 다음 줄로 내려가므로 가운뎃점을 뺀다 */}
                <span className="hidden md:inline">· </span>
                계획대로면 {formatChange(totalChange.planKcal, changeUnit)}
                {changeUnit}
              </span>
            </button>
          )}
        </>
      ) : (
        <button type="button" onClick={onOpenSettings} className="flex w-full items-center gap-2 text-left text-[15px] font-medium text-white/80">
          <Target className="h-5 w-5 shrink-0" aria-hidden />
          목표 몸무게를 정하면 여기에 남은 kg과 예상 달성일이 보여요 →
        </button>
      )}

      <p
        className={`mt-5 min-h-[1.5em] text-[15px] font-semibold text-[#FFB25C] transition-opacity duration-300 md:text-base ${visible ? "opacity-100" : "opacity-0"}`}
        aria-live="polite"
      >
        {message.includes(" — ") ? (
          <>
            {message.split(" — ")[0]}
            <span className="hidden md:inline"> </span>
            <br className="md:hidden" />— {message.split(" — ").slice(1).join(" — ")}
          </>
        ) : (
          message
        )}
      </p>
    </section>
  );
}
