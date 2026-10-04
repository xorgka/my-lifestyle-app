/**
 * 루틴·일과 항목 체크 → 다이어트 운동 자동 기록.
 *
 * 항목 제목에서 운동 종류를 알아내고(별칭 포함), 양은
 * 1) 제목에 적힌 숫자 → 2) 그 운동을 최근에 기록한 양 → 3) 프리셋 첫 값 순으로 정한다.
 * 체크를 풀면 이 기능으로 들어간 항목만 지운다(직접 적은 건 안 건드림).
 */

import { definedExerciseKcal, walkKcal } from "./dietCalc";
import { loadRoutineItems } from "./routineDb";
import {
  genDietId,
  getDietExercises,
  getDietProfile,
  loadDietDay,
  loadDietHistory,
  loadWeightLog,
  saveDietDay,
  type DietExercise,
  type ExerciseEntry,
} from "./dietDb";

/** 산책은 운동 목록에 없는 붙박이라 여기서 정의 (다이어트 화면과 같은 값) */
const WALK: DietExercise = { id: "walk", name: "산책", unit: "minutes", presets: [20, 30, 40, 50, 60], met: 3, tips: [] };

/** 제목에 흔히 쓰는 다른 이름 → 운동 id */
const ALIASES: Record<string, string> = {
  산책: "walk",
  걷기: "walk",
  "강아지 산책": "walk",
  트레드밀: "treadmill",
  러닝머신: "treadmill",
  푸쉬업: "pushup",
  푸시업: "pushup",
  팔굽혀펴기: "pushup",
  철봉: "pullup",
  턱걸이: "pullup",
  풀업: "pullup",
  데드행: "deadhang",
};

/** 비교용으로 공백·숫자·단위를 걷어낸 제목 */
function normalize(text: string): string {
  return text
    .replace(/\d+\s*(회|분|세트|set|개)?/gi, " ")
    .replace(/[()[\]·,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 제목에 적힌 양 (예: "푸쉬업 20회" → 20). 없으면 null */
function amountInTitle(text: string, unit: "reps" | "minutes"): number | null {
  const m = unit === "reps" ? text.match(/(\d+)\s*(회|개|rep)/i) : text.match(/(\d+)\s*(분|min)/i);
  if (m) return Number(m[1]);
  return null;
}

/** 제목이 가리키는 운동. 못 찾으면 null */
export function matchExercise(title: string): DietExercise | null {
  const defs = [WALK, ...getDietExercises()];
  const norm = normalize(title);
  if (!norm) return null;

  // 별칭 먼저 (철봉 → 풀업 처럼 이름이 다른 경우)
  for (const [word, id] of Object.entries(ALIASES)) {
    if (norm.includes(normalize(word))) {
      const found = defs.find((d) => d.id === id);
      if (found) return found;
      // 트레드밀은 운동 목록에 없는 붙박이라 별도 처리
      if (id === "treadmill") return { id: "treadmill", name: "트레드밀", unit: "minutes", presets: [20, 30, 40, 50, 60], met: 6, tips: [] };
    }
  }
  // 운동 이름이 제목에 그대로 들어 있는 경우
  return defs.find((d) => norm.includes(normalize(d.name))) ?? null;
}

/** 그 운동을 가장 최근에 기록한 양 */
async function lastLoggedAmount(ex: DietExercise, beforeDate: string): Promise<number | null> {
  const from = new Date(beforeDate);
  from.setDate(from.getDate() - 60);
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const history = await loadDietHistory(fromKey);
  const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of sorted) {
    const hit = [...d.exercises].reverse().find((e) => e.type === ex.id);
    if (hit) {
      const amount = ex.unit === "reps" ? hit.reps : hit.minutes;
      if (amount && amount > 0) return amount;
    }
  }
  return null;
}

function kcalFor(ex: DietExercise, weightKg: number, amount: number, walkSpeedKmh: number): number {
  if (ex.id === "walk") return walkKcal(weightKg, walkSpeedKmh, amount);
  return definedExerciseKcal(ex, weightKg, amount);
}

/**
 * 루틴·일과 항목을 체크/해제했을 때 그날 다이어트 운동을 맞춘다.
 * 운동으로 알아볼 수 없는 제목이면 아무것도 안 한다.
 */
export async function syncExerciseFromItem(dateKey: string, title: string, completed: boolean, itemId: string): Promise<void> {
  const ex = matchExercise(title);
  if (!ex) return;

  const { day } = await loadDietDay(dateKey);
  const linkedId = `link-${itemId}`;

  if (!completed) {
    const next = day.exercises.filter((e) => e.id !== linkedId);
    if (next.length === day.exercises.length) return;
    await saveDietDay({ ...day, exercises: next });
    return;
  }

  if (day.exercises.some((e) => e.id === linkedId)) return; // 이미 들어가 있음

  const profile = getDietProfile();
  // 그날 몸무게를 안 적었으면 그 날짜까지의 가장 최근 몸무게를 쓴다 (다이어트 화면과 같은 기준)
  let weightKg = day.weightKg;
  if (!weightKg) {
    const log = await loadWeightLog();
    const upto = log.filter((w) => w.date <= dateKey);
    weightKg = (upto.length > 0 ? upto[upto.length - 1] : log[log.length - 1])?.weightKg ?? null;
  }
  if (!weightKg) return; // 몸무게를 한 번도 안 적었으면 칼로리를 못 구함

  // 산책은 매일 30분이 기본이라 프리셋 첫 값(20분) 대신 30분으로 둔다
  const fallback = ex.id === "walk" ? 30 : ex.presets[0] ?? null;
  const amount = amountInTitle(title, ex.unit) ?? (await lastLoggedAmount(ex, dateKey)) ?? fallback;
  if (!amount) return;

  const entry: ExerciseEntry = {
    id: linkedId,
    type: ex.id,
    name: ex.name,
    kcal: Math.round(kcalFor(ex, weightKg, amount, profile.dailyActivities[0]?.speedKmh ?? 3.5)),
    ...(ex.unit === "reps" ? { reps: amount } : { minutes: amount }),
  };
  await saveDietDay({ ...day, exercises: [...day.exercises, entry] });
}

/** 루틴 id 로 부르는 판(알림 팝업처럼 제목을 안 들고 있는 곳에서 씀) */
export async function syncExerciseFromRoutineId(dateKey: string, routineId: number, completed: boolean): Promise<void> {
  const items = await loadRoutineItems();
  const title = items.find((i) => i.id === routineId)?.title;
  if (!title) return;
  await syncExerciseFromItem(dateKey, title, completed, String(routineId));
}

export { genDietId };
