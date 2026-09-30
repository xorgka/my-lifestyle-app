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

export type ExerciseType = "treadmill" | "pushup" | "pullup" | "custom";

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
};

/** 처음 쓸 때 기본으로 들어 있는 음식 (보통 1인분 기준 추정 칼로리. 설정에서 고칠 수 있음) */
const RICE: DietFood = { name: "작은 햇반 (130g)", kcal: 195 };
const GIM: DietFood = { name: "김 (도시락김 1봉)", kcal: 30 };
const DEFAULT_COMBO_FOODS = {
  samgyeop: { name: "삼겹살 (150g)", kcal: 500 },
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
