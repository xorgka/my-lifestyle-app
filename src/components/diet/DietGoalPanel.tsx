"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Flame, Target } from "lucide-react";
import { KCAL_PER_KG } from "@/lib/dietCalc";

const fmt = (n: number) => Math.round(n).toLocaleString();

function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 다이어트 목표 패널: 목표 체중 진행, 오늘 운동 목표 달성률, 연속 달성 일수, 번갈아 나오는 자극 문구.
 */
export function DietGoalPanel({
  targetWeightKg,
  weeklyLossKg,
  startWeightKg,
  currentWeightKg,
  todayExerciseKcal,
  exerciseGoalKcal,
  streakDays,
  todayAchieved,
  weekAchievedDays,
  actualDailyDeficit,
  paceDayCount,
  treadmillMinutesFor,
  treadmillLabel,
  onOpenSettings,
}: {
  targetWeightKg: number | null;
  weeklyLossKg: number;
  /** 처음 기록한 몸무게 */
  startWeightKg: number | null;
  currentWeightKg: number | null;
  todayExerciseKcal: number;
  exerciseGoalKcal: number;
  /** 운동 목표를 연속으로 달성한 날 수 (오늘 달성했으면 오늘 포함, 아니면 어제까지) */
  streakDays: number;
  todayAchieved: boolean;
  /** 최근 7일(오늘 포함) 중 운동 목표 달성한 날 */
  weekAchievedDays: number;
  /** 최근 실제 기록의 하루 평균 적자(kcal, +면 빠지는 중). 기록한 날이 3일 미만이면 null */
  actualDailyDeficit: number | null;
  /** 평균에 쓴 날 수 */
  paceDayCount: number;
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

  const exercisePct = exerciseGoalKcal > 0 ? Math.min(100, (todayExerciseKcal / exerciseGoalKcal) * 100) : 0;
  const exerciseLeft = Math.max(0, exerciseGoalKcal - todayExerciseKcal);
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
  if (todayAchieved) messages.push(`오늘 운동 목표 달성! ${fmt(todayExerciseKcal)}kcal 태웠어요`);
  else if (exerciseGoalKcal > 0)
    messages.push(
      leftMinutes != null
        ? `오늘 운동 ${fmt(exerciseLeft)}kcal 남았어요 — ${treadmillLabel} ${fmt(leftMinutes)}분이면 채워요`
        : `오늘 운동 ${fmt(exerciseLeft)}kcal 남았어요`
    );
  if (streakDays > 0)
    messages.push(todayAchieved ? `${streakDays}일 연속 운동 목표 달성 중이에요` : `${streakDays}일 연속 달성 중 — 오늘도 이어가면 ${streakDays + 1}일째예요`);
  else messages.push("오늘 운동 목표를 채우면 연속 기록이 시작돼요");
  messages.push(`최근 7일 중 ${weekAchievedDays}일 운동 목표를 채웠어요`);

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
    <section className="rounded-3xl bg-neutral-900 p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] md:p-7">
      {hasGoal ? (
        <>
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
              <p className="text-right text-sm tabular-nums text-white/60">
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
        </>
      ) : (
        <button type="button" onClick={onOpenSettings} className="flex w-full items-center gap-2 text-left text-[15px] font-medium text-white/80">
          <Target className="h-5 w-5 shrink-0" aria-hidden />
          목표 몸무게를 정하면 여기에 남은 kg과 예상 달성일이 보여요 →
        </button>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 md:gap-4">
        <div>
          <p className="text-xs font-medium text-white/50 md:text-sm">오늘 운동</p>
          <p className="mt-1 text-lg font-bold tabular-nums md:text-2xl">
            {fmt(todayExerciseKcal)}
            <span className="text-xs font-medium text-white/40 md:text-sm"> / {fmt(exerciseGoalKcal)}kcal</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className={`h-full rounded-full ${todayAchieved ? "bg-emerald-400" : "bg-[#F19E36]"}`} style={{ width: `${exercisePct}%` }} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-white/50 md:text-sm">연속 달성</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold tabular-nums md:text-2xl">
            <Flame className={`h-5 w-5 ${streakDays > 0 ? "text-[#FF7A45]" : "text-white/30"}`} aria-hidden />
            {streakDays}일
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-white/50 md:text-sm">최근 7일</p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold tabular-nums md:text-2xl">
            <CalendarCheck className="h-5 w-5 text-emerald-400" aria-hidden />
            {weekAchievedDays}/7일
          </p>
        </div>
      </div>

      <p
        className={`mt-4 min-h-[1.5em] text-[15px] font-semibold text-[#FFB25C] transition-opacity duration-300 md:text-base ${visible ? "opacity-100" : "opacity-0"}`}
        aria-live="polite"
      >
        {message}
      </p>
    </section>
  );
}
