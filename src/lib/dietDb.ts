/**
 * 다이어트 기록.
 * - 날짜별 먹은 것·운동·몸무게: Supabase diet_days 테이블(기기 동기화), 없거나 실패하면 localStorage
 * - 키/나이/성별/목표·음식 목록·자주 먹는 조합: user_settings (기기 동기화 설정)
 */

import { supabase } from "./supabase";
import { loadSetting, saveSetting } from "./userSettings";
import type { Sex } from "./dietCalc";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "아침" },
  { id: "lunch", label: "점심" },
  { id: "dinner", label: "저녁" },
  { id: "snack", label: "간식" },
];

export type MealEntry = { id: string; meal: MealType; name: string; kcal: number };

/** "treadmill"(트레드밀) · "custom"(기타, 칼로리 직접 입력) · 그 밖은 설정에서 만든 운동(DietExercise)의 id */
export type ExerciseType = string;

export type ExerciseEntry = {
  id: string;
  type: ExerciseType;
  name: string;
  kcal: number;
  minutes?: number;
  incline?: number;
  speed?: number;
  reps?: number;
};

export type DietDay = {
  date: string;
  meals: MealEntry[];
  exercises: ExerciseEntry[];
  weightKg: number | null;
};

/** 매일 하는 활동 (예: 강아지 산책 30분). 평지 걷기로 칼로리 자동 계산 */
export type DailyActivity = { id: string; name: string; minutes: number; speedKmh: number };

export type DietProfile = {
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  targetWeightKg: number | null;
  /** 주당 감량 목표(kg) */
  weeklyLossKg: number;
  /** 트레드밀 기본값 (시간만 바꿔 쓰게) */
  treadmillIncline: number;
  treadmillSpeed: number;
  /** 매일 하는 활동. 날마다 자동으로 소모 칼로리에 들어감 */
  dailyActivities: DailyActivity[];
  /** 하루 운동 목표(kcal). 그날 운동 칼로리가 이걸 넘으면 달성 */
  dailyExerciseGoalKcal: number;
  /** 트레드밀 탭 말풍선에 보여줄 효과 문구 */
  treadmillTips: string[];
};

/** 설정에서 추가·수정·삭제하는 운동 종류 (트레드밀·기타는 고정이라 여기 없음) */
export type DietExercise = {
  id: string;
  name: string;
  /** 횟수로 기록하는지 시간(분)으로 기록하는지 */
  unit: "reps" | "minutes";
  /** 빠르게 고르는 버튼 값 */
  presets: number[];
  /** 강도 (METs). dietCalc의 EXERCISE_INTENSITIES 참고 */
  met: number;
  /** 횟수 운동: 1회에 걸리는 시간(초) */
  secondsPerRep?: number;
  /** 운동 탭 말풍선에 보여줄 효과 문구 (한 줄에 하나) */
  tips: string[];
};

export type DietFood = { name: string; kcal: number };
export type DietCombo = { id: string; name: string; items: DietFood[] };

export const DEFAULT_DIET_PROFILE: DietProfile = {
  heightCm: null,
  age: null,
  sex: null,
  targetWeightKg: null,
  weeklyLossKg: 0.5,
  treadmillIncline: 12,
  treadmillSpeed: 5,
  dailyActivities: [{ id: "act-dog-walk", name: "강아지 산책", minutes: 30, speedKmh: 3.5 }],
  dailyExerciseGoalKcal: 300,
  treadmillTips: ["살이 쭉쭉 빠짐", "하체 근력 튼튼해짐", "체력 좋아짐"],
};

/** 처음 쓸 때 기본으로 들어 있는 운동 (id는 예전 기록의 운동 종류와 같게 둠) */
export const DEFAULT_DIET_EXERCISES: DietExercise[] = [
  {
    id: "pushup",
    name: "팔굽혀펴기",
    unit: "reps",
    presets: [10, 20, 30, 50, 100, 150, 200, 250, 300],
    met: 8,
    secondsPerRep: 2.5,
    tips: ["가슴 두꺼워짐", "팔뚝 탄탄해짐", "요요 막아줌"],
  },
  {
    id: "pullup",
    name: "풀업",
    unit: "reps",
    presets: [5, 10, 15, 20, 30, 50, 100],
    met: 8,
    secondsPerRep: 3,
    tips: ["코어 강화, 복근도 생김", "어깨 넓어짐", "굽은 어깨 펴짐"],
  },
  { id: "deadhang", name: "데드행", unit: "minutes", presets: [1, 3, 5], met: 3.8, tips: [] },
];

/** 처음 쓸 때 기본으로 들어 있는 음식 (보통 1인분 기준 추정 칼로리. 설정에서 고칠 수 있음) */
const RICE: DietFood = { name: "작은 햇반 (130g)", kcal: 195 };
const GIM: DietFood = { name: "김 (도시락김 1봉)", kcal: 30 };
const DEFAULT_COMBO_FOODS = {
  samgyeop: { name: "삼겹살 (100g)", kcal: 333 },
  sauce: { name: "기름장·쌈장", kcal: 60 },
  greens: { name: "양상추·배추 (쌈 채소)", kcal: 15 },
  chicken: { name: "닭가슴살 (100g)", kcal: 110 },
  kimchi: { name: "김치 (50g)", kcal: 15 },
  egg: { name: "계란후라이 1개", kcal: 90 },
  tuna: { name: "참치캔 (100g)", kcal: 150 },
} satisfies Record<string, DietFood>;

/** 처음 쓸 때 기본으로 들어 있는 자주 먹는 조합 */
export const DEFAULT_DIET_COMBOS: DietCombo[] = [
  {
    id: "combo-samgyeop",
    name: "삼겹살 세트",
    items: [RICE, DEFAULT_COMBO_FOODS.samgyeop, DEFAULT_COMBO_FOODS.sauce, DEFAULT_COMBO_FOODS.greens],
  },
  { id: "combo-chicken", name: "닭가슴살 세트", items: [RICE, DEFAULT_COMBO_FOODS.chicken, DEFAULT_COMBO_FOODS.kimchi] },
  { id: "combo-egg", name: "계란후라이 세트", items: [RICE, DEFAULT_COMBO_FOODS.egg, GIM] },
  { id: "combo-tuna", name: "참치 세트", items: [RICE, DEFAULT_COMBO_FOODS.tuna, GIM] },
];

export const DEFAULT_DIET_FOODS: DietFood[] = [RICE, GIM, ...Object.values(DEFAULT_COMBO_FOODS)];

export const DIET_SETTINGS_CHANGED_EVENT = "diet-settings-changed";

/** 그날 기록(식사·운동·몸무게)이 저장됐을 때. detail에 저장한 하루 기록(DietDay)이 담긴다.
 * 서버 저장이 끝나기 전에 알리므로, 받는 쪽은 서버를 다시 읽지 말고 detail을 그대로 써야 한다 */
export const DIET_DAY_CHANGED_EVENT = "diet-day-changed";

export function genDietId(): string {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- 설정 (user_settings) ----------

export function getDietProfile(): DietProfile {
  const v = loadSetting<Partial<DietProfile> | null>("diet-profile", null);
  return { ...DEFAULT_DIET_PROFILE, ...(v && typeof v === "object" ? v : {}) };
}

export function saveDietProfile(profile: DietProfile): void {
  saveSetting("diet-profile", profile);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DIET_SETTINGS_CHANGED_EVENT));
}

export function getDietFoods(): DietFood[] {
  // 한 번도 저장한 적 없으면 기본 음식 목록 (저장한 뒤엔 지워도 다시 안 생김)
  const v = loadSetting<unknown>("diet-foods", DEFAULT_DIET_FOODS);
  return Array.isArray(v) ? v.filter((f): f is DietFood => !!f && typeof f.name === "string" && typeof f.kcal === "number") : [];
}

export function saveDietFoods(foods: DietFood[]): void {
  saveSetting("diet-foods", foods);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DIET_SETTINGS_CHANGED_EVENT));
}

/** 음식 목록에 추가/칼로리 갱신 (이름이 같으면 덮어씀) */
export function rememberDietFood(food: DietFood): DietFood[] {
  const name = food.name.trim();
  if (!name) return getDietFoods();
  const next = [{ name, kcal: food.kcal }, ...getDietFoods().filter((f) => f.name !== name)];
  saveDietFoods(next);
  return next;
}

export function getDietCombos(): DietCombo[] {
  // 한 번도 저장한 적 없으면 기본 조합 (저장한 뒤엔 지워도 다시 안 생김)
  const v = loadSetting<unknown>("diet-combos", DEFAULT_DIET_COMBOS);
  return Array.isArray(v)
    ? v.filter((c): c is DietCombo => !!c && typeof c.id === "string" && typeof c.name === "string" && Array.isArray(c.items))
    : [];
}

export function saveDietCombos(combos: DietCombo[]): void {
  saveSetting("diet-combos", combos);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DIET_SETTINGS_CHANGED_EVENT));
}

export function getDietExercises(): DietExercise[] {
  // 한 번도 저장한 적 없으면 기본 운동 (저장한 뒤엔 지워도 다시 안 생김)
  const v = loadSetting<unknown>("diet-exercises", DEFAULT_DIET_EXERCISES);
  return Array.isArray(v)
    ? v
        .filter((e): e is DietExercise => !!e && typeof e.id === "string" && typeof e.name === "string")
        .map((e) => ({
          ...e,
          unit: e.unit === "minutes" ? "minutes" : "reps",
          presets: Array.isArray(e.presets) ? e.presets.filter((n) => typeof n === "number" && n > 0) : [],
          met: typeof e.met === "number" && e.met > 1 ? e.met : 3.8,
          tips: Array.isArray(e.tips) ? e.tips.filter((t) => typeof t === "string") : [],
        }))
    : [];
}

export function saveDietExercises(exercises: DietExercise[]): void {
  saveSetting("diet-exercises", exercises);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DIET_SETTINGS_CHANGED_EVENT));
}

// ---------- 날짜별 기록 (diet_days) ----------

const STORAGE_KEY = "diet-days";

function loadAllLocal(): Record<string, DietDay> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocal(day: DietDay): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadAllLocal();
    all[day.date] = day;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function emptyDay(date: string): DietDay {
  return { date, meals: [], exercises: [], weightKg: null };
}

function rowToDay(row: Record<string, unknown>): DietDay {
  return {
    date: String(row.date),
    meals: Array.isArray(row.meals) ? (row.meals as MealEntry[]) : [],
    exercises: Array.isArray(row.exercises) ? (row.exercises as ExerciseEntry[]) : [],
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
  };
}

export type DietLoadSource = "supabase" | "local";

export async function loadDietDay(date: string): Promise<{ day: DietDay; source: DietLoadSource }> {
  if (supabase) {
    const { data, error } = await supabase.from("diet_days").select("*").eq("date", date).maybeSingle();
    if (!error) return { day: data ? rowToDay(data) : emptyDay(date), source: "supabase" };
    console.warn("[dietDb] loadDietDay", error.message, "- localStorage 사용. diet_days 테이블 생성 여부 확인.");
  }
  const local = loadAllLocal()[date];
  return { day: local ? { ...emptyDay(date), ...local } : emptyDay(date), source: "local" };
}

/** 하루 기록 전체 저장 (먹은 것·운동·몸무게) */
export async function saveDietDay(day: DietDay): Promise<void> {
  saveLocal(day);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<DietDay>(DIET_DAY_CHANGED_EVENT, { detail: day }));
  if (!supabase) return;
  const { error } = await supabase.from("diet_days").upsert(
    {
      date: day.date,
      meals: day.meals,
      exercises: day.exercises,
      weight_kg: day.weightKg,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date" }
  );
  if (error) console.warn("[dietDb] saveDietDay", error.message);
}

/** fromDate(YYYY-MM-DD) 이후 날짜별 기록 (날짜 오름차순). 먹은 것·운동·몸무게 통계용 */
export async function loadDietHistory(fromDate: string): Promise<DietDay[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("diet_days")
      .select("*")
      .gte("date", fromDate)
      .order("date", { ascending: true });
    if (!error) return (data ?? []).map(rowToDay);
    console.warn("[dietDb] loadDietHistory", error.message);
  }
  return Object.values(loadAllLocal())
    .filter((d) => d.date >= fromDate)
    .map((d) => ({ ...emptyDay(d.date), ...d }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 몸무게 기록 전체 (날짜 오름차순). 추이 그래프·현재 몸무게용 */
export async function loadWeightLog(): Promise<{ date: string; weightKg: number }[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("diet_days")
      .select("date, weight_kg")
      .not("weight_kg", "is", null)
      .order("date", { ascending: true });
    if (!error) return (data ?? []).map((r) => ({ date: String(r.date), weightKg: Number(r.weight_kg) }));
    console.warn("[dietDb] loadWeightLog", error.message);
  }
  return Object.values(loadAllLocal())
    .filter((d) => d.weightKg != null)
    .map((d) => ({ date: d.date, weightKg: Number(d.weightKg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- 일회성 보정 ----------

const SAMGYEOP_OLD = "삼겹살 (150g)";
const SAMGYEOP_NEW = "삼겹살 (100g)";
const SAMGYEOP_FIX_DONE_KEY = "diet-fix-samgyeop-100g";

/** 150g 기준 칼로리를 100g으로 (예: 500 → 333) */
function samgyeopKcal(kcal: number): number {
  return Math.round((kcal * 100) / 150);
}

/**
 * 삼겹살은 실제로 100g이었다: 지난 기록·음식 목록·조합의 "삼겹살 (150g)"을 전부 "삼겹살 (100g)"으로 바꾸고 칼로리도 100/150로 줄인다.
 * 이름이 정확히 같은 항목만 바꾸므로 여러 번 돌아도 안전하다. 설정 동기화가 끝난 뒤에 불러야 서버 값을 덮어쓰지 않는다.
 */
export async function fixSamgyeopTo100g(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SAMGYEOP_FIX_DONE_KEY)) return;
  } catch {}

  // 서버 기록을 못 읽으면(오프라인 등) 다음에 다시 시도한다
  let days: DietDay[];
  if (supabase) {
    const { data, error } = await supabase.from("diet_days").select("*");
    if (error) return;
    days = (data ?? []).map(rowToDay);
  } else {
    days = Object.values(loadAllLocal()).map((d) => ({ ...emptyDay(d.date), ...d }));
  }

  const fixFood = (f: DietFood): DietFood => (f.name === SAMGYEOP_OLD ? { name: SAMGYEOP_NEW, kcal: samgyeopKcal(f.kcal) } : f);

  const foods = getDietFoods();
  if (foods.some((f) => f.name === SAMGYEOP_OLD)) {
    // 이미 100g 항목이 있으면 겹치지 않게 150g 항목은 빼기만 한다
    const hasNew = foods.some((f) => f.name === SAMGYEOP_NEW);
    saveDietFoods(hasNew ? foods.filter((f) => f.name !== SAMGYEOP_OLD) : foods.map(fixFood));
  }
  const combos = getDietCombos();
  if (combos.some((c) => c.items.some((i) => i.name === SAMGYEOP_OLD))) {
    saveDietCombos(combos.map((c) => ({ ...c, items: c.items.map(fixFood) })));
  }

  let failed = false;
  for (const day of days) {
    if (!day.meals.some((m) => m.name === SAMGYEOP_OLD)) continue;
    const fixed: DietDay = {
      ...day,
      meals: day.meals.map((m) => (m.name === SAMGYEOP_OLD ? { ...m, name: SAMGYEOP_NEW, kcal: samgyeopKcal(m.kcal) } : m)),
    };
    saveLocal(fixed);
    window.dispatchEvent(new CustomEvent<DietDay>(DIET_DAY_CHANGED_EVENT, { detail: fixed }));
    if (supabase) {
      const { error } = await supabase
        .from("diet_days")
        .update({ meals: fixed.meals, updated_at: new Date().toISOString() })
        .eq("date", fixed.date);
      if (error) failed = true;
    }
  }
  if (failed) return;

  try {
    window.localStorage.setItem(SAMGYEOP_FIX_DONE_KEY, "1");
  } catch {}
}
