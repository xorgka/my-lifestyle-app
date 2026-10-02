"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Dumbbell, Utensils, type LucideIcon } from "lucide-react";
import {
  DEFAULT_DIET_PROFILE,
  DIET_SETTINGS_CHANGED_EVENT,
  type DietDay,
  type DietExercise,
  type DietProfile,
  getDietExercises,
  getDietProfile,
  loadDietDay,
  loadWeightLog,
  todayDateKey,
} from "@/lib/dietDb";
import { calcBmr, calcDailyBase, dailyDeficitTarget, definedExerciseKcal, treadmillKcalPerMin, walkKcal } from "@/lib/dietCalc";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";
import { formatChange, useChangeUnit } from "@/components/diet/useChangeUnit";

const fmt = (n: number) => Math.round(n).toLocaleString();

/** 남은 운동 안내에 트레드밀과 같이 넣는 운동: [설정의 운동 id, 횟수, 카드에 쓸 짧은 이름(없으면 설정의 이름)] */
const NOTE_COMBOS: [string, number, string?][] = [
  ["pushup", 100, "푸시업"],
  ["pullup", 30],
];

/** 게이지 한 줄: 아이콘 + 값 / 목표 (같은 줄 오른쪽에 안내 문구), 막대 */
function Gauge({
  icon: Icon,
  label,
  value,
  goal,
  over,
  note,
}: {
  icon: LucideIcon;
  /** 화면에는 아이콘만, 읽기용 이름 */
  label: string;
  value: number;
  goal: number | null;
  over?: boolean;
  /** 숫자 줄 오른쪽 안내 (폴드 폭에선 칸이 좁아 숨김) */
  note?: ReactNode;
}) {
  const pct = goal != null && goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="flex shrink-0 items-center gap-1 tabular-nums leading-tight md:gap-1.5">
          <Icon className="h-5 w-5 shrink-0 text-white/55 md:h-6 md:w-6" strokeWidth={2} aria-label={label} />
          <span className={`text-2xl font-bold md:text-[28px] ${over ? "text-red-400" : "text-white"}`}>{fmt(value)}</span>
          {goal != null && <span className="text-xs font-medium text-white/45">/ {fmt(goal)}</span>}
        </p>
        {note && <div className="min-w-0 truncate text-right text-[13px] font-semibold tabular-nums md:max-xl:hidden">{note}</div>}
      </div>
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
  const [exerciseDefs, setExerciseDefs] = useState<DietExercise[]>([]);

  const load = useCallback(() => {
    setProfile(getDietProfile());
    setExerciseDefs(getDietExercises());
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
  const overKcal = allowed != null && intake > allowed ? intake - allowed : 0;
  /** 오늘 예상 변화(kcal): 먹은 양 − 쓴 칼로리(기본 + 매일 활동 + 운동). 다이어트 페이지 "예상 변화"와 같은 값 */
  const changeKcal = base != null ? intake - (base + dailyActivityKcal + exerciseKcal) : null;

  // 남은 운동량: 설정한 트레드밀로 몇 분, 또는 팔굽혀펴기 100회·풀업 30회 + 트레드밀 몇 분 (번갈아 표시)
  const exerciseGoal = profile.dailyExerciseGoalKcal;
  const exerciseLeft = Math.max(0, exerciseGoal - exerciseKcal);
  const tmPerMin =
    weightNow && profile.treadmillSpeed > 0 ? treadmillKcalPerMin(weightNow, profile.treadmillSpeed, profile.treadmillIncline) : 0;
  const tmLabel = `트레드밀 ${profile.treadmillIncline}%·${profile.treadmillSpeed}km/h`;
  const exerciseNotes: string[] = [];
  if (exerciseGoal > 0 && exerciseLeft === 0) exerciseNotes.push("운동 목표 달성!");
  else if (exerciseLeft > 0 && tmPerMin > 0) {
    exerciseNotes.push(`${tmLabel} ${Math.ceil(exerciseLeft / tmPerMin)}분`);
    // 설정에서 지운 운동은 건너뛰고, 그 운동만으로 거의 채워지면 조합 안내는 생략
    NOTE_COMBOS.forEach(([id, reps, shortName]) => {
      const ex = exerciseDefs.find((x) => x.id === id);
      if (!ex) return;
      const kcal = definedExerciseKcal(ex, weightNow!, reps);
      if (exerciseLeft - kcal >= tmPerMin * 5)
        exerciseNotes.push(`트레드밀 ${Math.ceil((exerciseLeft - kcal) / tmPerMin)}분 + ${shortName ?? ex.name} ${reps}${ex.unit === "reps" ? "회" : "분"}`);
    });
  }
  const [changeUnit, toggleChangeUnit] = useChangeUnit();
  const [noteIndex, setNoteIndex] = useState(0);
  const [noteVisible, setNoteVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setNoteVisible(false);
      setTimeout(() => {
        setNoteIndex((i) => i + 1);
        setNoteVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(id);
  }, []);
  const exerciseNote = exerciseNotes.length > 0 ? exerciseNotes[noteIndex % exerciseNotes.length] : null;
  // 많이 먹은 날: 초과한 칼로리와, 그걸 트레드밀로 만회하려면 몇 분인지 (번갈아 표시)
  const overNotes: string[] = [];
  if (overKcal > 0) {
    overNotes.push(`${fmt(overKcal)}kcal 초과`);
    if (tmPerMin > 0) overNotes.push(`트레드밀 ${Math.ceil(overKcal / tmPerMin)}분이면 만회`);
  }
  const overNote = overNotes.length > 0 ? overNotes[noteIndex % overNotes.length] : null;

  const remainKg =
    profile.targetWeightKg != null && weightNow != null ? Math.max(0, weightNow - profile.targetWeightKg) : null;

  return (
    <Link
      href="/diet"
      className={`flex min-h-0 min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-3xl bg-neutral-900 p-6 text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] md:gap-3 md:px-6 md:py-7 ${className}`}
    >
      {/* 제목 줄 오른쪽에 목표 체중 · 오늘 예상 체중 변화 (폴드 폭에선 칸이 좁아 잘려서 숨김) */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="shrink-0 text-base font-bold">다이어트</p>
        <p className="min-w-0 truncate text-[12px] font-semibold tabular-nums text-white/60 md:text-[13px] md:max-xl:hidden">
          {remainKg != null &&
            (remainKg > 0 ? `목표 ${profile.targetWeightKg}kg까지 ${remainKg.toFixed(1)}kg` : `목표 ${profile.targetWeightKg}kg 달성`)}
          {remainKg != null && changeKcal != null && <span className="mx-0.5 text-white/25 md:mx-1">·</span>}
          {changeKcal != null && (
            <>
              오늘{" "}
              {/* 누르면 kcal ↔ kg. 카드 전체가 링크라 이동은 막는다 */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleChangeUnit();
                }}
                title={changeUnit === "kg" ? "누르면 kcal로 보기" : "누르면 kg으로 보기"}
                className={changeKcal > 0 ? "text-red-400" : "text-emerald-400"}
              >
                {formatChange(changeKcal, changeUnit)}
                {changeUnit}
              </span>
            </>
          )}
        </p>
      </div>
      <Gauge
        icon={Utensils}
        label="먹은 양"
        value={intake}
        goal={allowed != null ? Math.max(0, allowed) : null}
        over={overKcal > 0}
        note={
          overNote ? (
            <span className={`text-red-400 transition-opacity duration-300 ${noteVisible ? "opacity-100" : "opacity-0"}`}>{overNote}</span>
          ) : null
        }
      />
      <Gauge
        icon={Dumbbell}
        label="운동"
        value={exerciseKcal}
        goal={exerciseGoal > 0 ? exerciseGoal : null}
        note={
          exerciseNote ? (
            <span className={`text-[#FFB25C] transition-opacity duration-300 ${noteVisible ? "opacity-100" : "opacity-0"}`}>
              {exerciseNote}
            </span>
          ) : null
        }
      />
    </Link>
  );
}
