"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { DietSettingsModal } from "@/components/diet/DietSettingsModal";
import { WeightChart } from "@/components/diet/WeightChart";
import { DailyBarChart } from "@/components/diet/DailyBarChart";
import { DietGoalPanel } from "@/components/diet/DietGoalPanel";
import { Settings } from "lucide-react";
import {
  DEFAULT_DIET_PROFILE,
  DIET_SETTINGS_CHANGED_EVENT,
  MEAL_TYPES,
  type DietCombo,
  type DietDay,
  type DietFood,
  type DietProfile,
  type ExerciseEntry,
  type MealEntry,
  type MealType,
  genDietId,
  getDietCombos,
  getDietFoods,
  getDietProfile,
  loadDietDay,
  loadDietHistory,
  loadWeightLog,
  rememberDietFood,
  saveDietCombos,
  saveDietDay,
  todayDateKey,
} from "@/lib/dietDb";
import {
  bmiLabel,
  calcBmi,
  calcBmr,
  calcDailyBase,
  dailyDeficitTarget,
  kcalToGrams,
  pullupKcal,
  pushupKcal,
  treadmillKcal,
  treadmillKcalPerMin,
  walkKcal,
} from "@/lib/dietCalc";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";

const cardClass =
  "rounded-3xl bg-white p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] md:p-6";
const inputClass =
  "min-w-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[15px] text-neutral-900 tabular-nums placeholder:text-neutral-300 focus:border-neutral-400 focus:outline-none";
const chipClass = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition ${
    on ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
  }`;

const fmt = (n: number) => Math.round(n).toLocaleString();
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

/** 한 끼: 음식 목록·합계, 음식 추가(이름 치면 저장된 칼로리 자동 채움), 조합 불러오기/저장 */
function MealBlock({
  meal,
  label,
  entries,
  foods,
  combos,
  onAdd,
  onRemove,
  onSaveCombo,
}: {
  meal: MealType;
  label: string;
  entries: MealEntry[];
  foods: DietFood[];
  combos: DietCombo[];
  onAdd: (items: DietFood[]) => void;
  onRemove: (id: string) => void;
  onSaveCombo: (name: string, items: DietFood[]) => void;
}) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [comboName, setComboName] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const total = entries.reduce((s, e) => s + e.kcal, 0);
  /** 음식 제안: foods는 자주 먹은 순. 친 글자가 들어간 것 중 6개만 (음식이 많아져도 목록이 안 길어지게) */
  const q = name.trim();
  const suggestions = (q ? foods.filter((f) => f.name.includes(q) && f.name !== q) : foods).slice(0, 6);

  const add = () => {
    const n = name.trim();
    const k = Number(kcal);
    if (!n || kcal.trim() === "" || Number.isNaN(k)) return;
    onAdd([{ name: n, kcal: k }]);
    setName("");
    setKcal("");
  };

  return (
    // min-w-0: 그리드 칸 안에서 폰 폭보다 넓어지지 않게 (기본값이면 입력칸·선택창의 원래 폭 때문에 화면 밖으로 넘침)
    <div className="min-w-0 rounded-2xl bg-neutral-50 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold text-neutral-900">{label}</h3>
        <span className="text-[15px] font-semibold tabular-nums text-neutral-900">
          {fmt(total)}
          <span className="ml-0.5 text-xs font-medium text-neutral-400">kcal</span>
        </span>
      </div>

      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-200/70">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-800">{e.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-neutral-500">{fmt(e.kcal)}kcal</span>
              <button
                type="button"
                onClick={() => onRemove(e.id)}
                className="shrink-0 rounded-md px-1.5 text-lg leading-none text-neutral-300 transition hover:text-red-500"
                aria-label={`${e.name} 빼기`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSuggestOpen(true);
              const known = foods.find((f) => f.name === e.target.value.trim());
              if (known) setKcal(String(known.kcal));
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setSuggestOpen(false)}
            placeholder="음식"
            autoComplete="off"
            className={`${inputClass} w-full`}
            aria-label={`${label} 음식 이름`}
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
              {suggestions.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    // 입력칸 blur보다 먼저 눌리게
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setName(f.name);
                      setKcal(String(f.kcal));
                      setSuggestOpen(false);
                    }}
                    className="block w-full truncate px-3 py-2 text-left text-[15px] text-neutral-700 transition hover:bg-neutral-50"
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          inputMode="numeric"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder="kcal"
          className={`${inputClass} w-20 text-right`}
          aria-label={`${label} 칼로리`}
        />
        <button type="submit" className="shrink-0 rounded-xl bg-neutral-900 px-3 text-[15px] font-semibold text-white hover:bg-neutral-700">
          추가
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {combos.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const c = combos.find((x) => x.id === e.target.value);
              if (c) onAdd(c.items);
            }}
            className="max-w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-600 focus:outline-none"
            aria-label={`${label}에 조합 불러오기`}
          >
            <option value="">조합 불러오기</option>
            {combos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({fmt(c.items.reduce((s, i) => s + i.kcal, 0))}kcal)
              </option>
            ))}
          </select>
        )}
        {entries.length > 0 &&
          (comboName == null ? (
            <button
              type="button"
              onClick={() => setComboName("")}
              title="지금 음식들을 조합으로 저장"
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              저장
            </button>
          ) : (
            <form
              className="flex min-w-0 flex-1 gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!comboName.trim()) return;
                onSaveCombo(comboName.trim(), entries.map((x) => ({ name: x.name, kcal: x.kcal })));
                setComboName(null);
              }}
            >
              <input
                autoFocus
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
                placeholder="조합 이름"
                className={`${inputClass} min-w-0 flex-1 py-1 text-sm`}
              />
              <button type="submit" className="rounded-lg bg-neutral-900 px-2.5 text-sm font-medium text-white">
                저장
              </button>
              <button type="button" onClick={() => setComboName(null)} className="rounded-lg px-2 text-sm text-neutral-400">
                취소
              </button>
            </form>
          ))}
      </div>
    </div>
  );
}

type ExerciseTab = "treadmill" | "pushup" | "pullup" | "custom";
type RepsExercise = "pushup" | "pullup";

/** 횟수로 기록하는 운동 */
const REPS_EXERCISES: Record<
  RepsExercise,
  { name: string; presets: number[]; kcal: (weightKg: number, reps: number) => number }
> = {
  pushup: { name: "팔굽혀펴기", presets: [10, 20, 30, 50, 100, 150, 200, 250, 300], kcal: pushupKcal },
  pullup: { name: "턱걸이", presets: [5, 10, 15, 20, 30, 50, 100], kcal: pullupKcal },
};

const HISTORY_RANGES = [
  { id: 7, label: "7일" },
  { id: 30, label: "30일" },
  { id: 90, label: "90일" },
  { id: 180, label: "6개월" },
  { id: 365, label: "1년" },
  { id: "all", label: "전체" },
] as const;
type HistoryRange = (typeof HISTORY_RANGES)[number]["id"];
const HISTORY_TABS = [
  { id: "table", label: "날짜별 표" },
  { id: "weight", label: "몸무게" },
  { id: "intake", label: "먹은 칼로리" },
  { id: "exercise", label: "운동" },
] as const;
type HistoryTab = (typeof HISTORY_TABS)[number]["id"];

export default function DietPage() {
  const [date, setDate] = useState(todayDateKey);
  const [day, setDay] = useState<DietDay | null>(null);
  const [source, setSource] = useState<"supabase" | "local" | null>(null);
  const [weights, setWeights] = useState<{ date: string; weightKg: number }[]>([]);
  const [profile, setProfile] = useState<DietProfile>(DEFAULT_DIET_PROFILE);
  const [foods, setFoods] = useState<DietFood[]>([]);
  const [combos, setCombos] = useState<DietCombo[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("table");
  const [historyRange, setHistoryRange] = useState<HistoryRange>(30);
  const [history, setHistory] = useState<DietDay[]>([]);
  /** 운동 연속 달성 계산용 최근 기록 (기록 탭 기간과 별개) */
  const [recent, setRecent] = useState<DietDay[]>([]);

  const [exTab, setExTab] = useState<ExerciseTab>("treadmill");
  /** 폰에서 탭을 누르면 보이는 운동 효과 툴팁. 다른 곳을 누를 때까지 유지 */
  const [tipFor, setTipFor] = useState<ExerciseTab | null>(null);
  useEffect(() => {
    if (!tipFor) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-exercise-tab]")) setTipFor(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [tipFor]);
  const [tmIncline, setTmIncline] = useState("");
  const [tmSpeed, setTmSpeed] = useState("");
  const [tmMinutes, setTmMinutes] = useState("30");
  const [repsInput, setRepsInput] = useState<Record<RepsExercise, string>>({ pushup: "20", pullup: "10" });
  const [customName, setCustomName] = useState("");
  const [customKcal, setCustomKcal] = useState("");

  // 설정(키·목표·음식·조합): 이 기기에서 바꿀 때·다른 기기에서 동기화될 때 다시 읽기
  useEffect(() => {
    const sync = () => {
      const p = getDietProfile();
      setProfile(p);
      setTmIncline((v) => v || String(p.treadmillIncline));
      setTmSpeed((v) => v || String(p.treadmillSpeed));
      setFoods(getDietFoods());
      setCombos(getDietCombos());
    };
    sync();
    window.addEventListener(DIET_SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    return () => {
      window.removeEventListener(DIET_SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDay(null);
    loadDietDay(date).then(({ day: d, source: s }) => {
      if (cancelled) return;
      setDay(d);
      setSource(s);
      setWeightInput(d.weightKg != null ? String(d.weightKg) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const refreshWeights = useCallback(() => {
    loadWeightLog().then(setWeights);
  }, []);
  useEffect(() => {
    refreshWeights();
  }, [refreshWeights]);

  /** 불러올 시작 날짜. 전체면 처음부터 */
  const historyFrom = historyRange === "all" ? "1970-01-01" : shiftDateKey(todayDateKey(), 1 - historyRange);

  useEffect(() => {
    let cancelled = false;
    loadDietHistory(historyFrom).then((list) => {
      if (!cancelled) setHistory(list);
    });
    return () => {
      cancelled = true;
    };
  }, [historyFrom]);

  useEffect(() => {
    let cancelled = false;
    loadDietHistory(shiftDateKey(todayDateKey(), -400)).then((list) => {
      if (!cancelled) setRecent(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 기록 기간의 날짜 목록 (오늘까지, 하루도 빠짐없이). 전체면 처음 기록한 날부터 */
  const historyDates = useMemo(() => {
    const today = todayDateKey();
    const first = history[0]?.date;
    const start = historyRange === "all" ? (first && first < today ? first : today) : historyFrom;
    const out: string[] = [];
    for (let d = start; d <= today; d = shiftDateKey(d, 1)) out.push(d);
    return out;
  }, [historyRange, historyFrom, history]);

  const update = (next: DietDay) => {
    setDay(next);
    // 기록 탭도 바로 반영
    const merge = (list: DietDay[]) => [...list.filter((d) => d.date !== next.date), next].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(merge);
    setRecent(merge);
    void saveDietDay(next).then(() => {
      if (next.weightKg !== day?.weightKg) refreshWeights();
    });
  };

  /** 이 날짜 기준 몸무게: 그날 기록, 없으면 그 전 가장 최근 기록 */
  const weightNow = useMemo(() => {
    if (day?.weightKg != null) return day.weightKg;
    const before = weights.filter((w) => w.date <= date);
    return before.length > 0 ? before[before.length - 1].weightKg : null;
  }, [day?.weightKg, weights, date]);

  const ready = !!(profile.sex && profile.age && profile.heightCm && weightNow);
  const bmr = ready ? calcBmr(profile.sex!, weightNow!, profile.heightCm!, profile.age!) : null;
  const base = bmr != null ? calcDailyBase(bmr) : null;
  const bmi = weightNow && profile.heightCm ? calcBmi(weightNow, profile.heightCm) : null;

  const meals = day?.meals ?? [];
  const exercises = day?.exercises ?? [];
  const intake = meals.reduce((s, m) => s + m.kcal, 0);
  const exerciseKcal = exercises.reduce((s, e) => s + e.kcal, 0);
  /** 매일 하는 활동(강아지 산책 등): 날마다 항상 포함 */
  const dailyActivityKcal = weightNow
    ? profile.dailyActivities.reduce((s, a) => s + walkKcal(weightNow, a.speedKmh, a.minutes), 0)
    : 0;
  const burn = base != null ? base + dailyActivityKcal + exerciseKcal : null;
  const balance = burn != null ? intake - burn : null;
  const deficitTarget = dailyDeficitTarget(profile.weeklyLossKg);

  /** 운동 안 하는 날 목표 섭취 = 기본 + 매일 활동 − 목표 적자 */
  const targetIntake = base != null ? base + dailyActivityKcal - deficitTarget : null;

  // 기록 탭: 날짜별 먹은 칼로리·운동 칼로리
  const intakeByDate: Record<string, number> = {};
  const exerciseByDate: Record<string, number> = {};
  const exerciseStats = { days: 0, kcal: 0, treadmillMin: 0, pushups: 0, pullups: 0 };
  history.forEach((d) => {
    const eaten = d.meals.reduce((s, m) => s + m.kcal, 0);
    const burned = d.exercises.reduce((s, e) => s + e.kcal, 0);
    if (eaten > 0) intakeByDate[d.date] = eaten;
    if (burned > 0) {
      exerciseByDate[d.date] = burned;
      exerciseStats.days += 1;
      exerciseStats.kcal += burned;
    }
    d.exercises.forEach((e) => {
      if (e.type === "treadmill") exerciseStats.treadmillMin += e.minutes ?? 0;
      if (e.type === "pushup") exerciseStats.pushups += e.reps ?? 0;
      if (e.type === "pullup") exerciseStats.pullups += e.reps ?? 0;
    });
  });
  const intakeDays = Object.keys(intakeByDate);
  const intakeStats = {
    days: intakeDays.length,
    avg: intakeDays.length > 0 ? intakeDays.reduce((s, k) => s + intakeByDate[k], 0) / intakeDays.length : 0,
  };
  const tableRows = [...history]
    .filter((d) => d.meals.length > 0 || d.exercises.length > 0 || d.weightKg != null)
    .reverse()
    .map((d) => {
      const intake = d.meals.reduce((s, m) => s + m.kcal, 0);
      const exercise = d.exercises.reduce((s, e) => s + e.kcal, 0);
      const net = base != null && intake > 0 ? intake - (base + dailyActivityKcal + exercise) : null;
      return { date: d.date, intake, exercise, weight: d.weightKg, grams: net != null ? kcalToGrams(net) : null };
    });

  const incline = Number(tmIncline) || 0;
  const speed = Number(tmSpeed) || 0;
  const kcalPerMin = weightNow && speed > 0 ? treadmillKcalPerMin(weightNow, speed, incline) : 0;

  /** 음식 목록을 자주 먹은 순으로 (최근 기록의 이름별 횟수, 같으면 최근에 기억한 순) */
  const foodsByFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    recent.forEach((d) => d.meals.forEach((m) => counts.set(m.name, (counts.get(m.name) ?? 0) + 1)));
    return foods
      .map((f, i) => ({ f, i, c: counts.get(f.name) ?? 0 }))
      .sort((x, y) => y.c - x.c || x.i - y.i)
      .map((x) => x.f);
  }, [foods, recent]);

  // 운동 목표: 날짜별 운동 칼로리(매일 활동 제외)로 연속 달성·최근 7일 계산
  const today = todayDateKey();
  const exerciseKcalOn = (dateKey: string) => {
    const d = dateKey === date && day ? day : recent.find((x) => x.date === dateKey);
    return d ? d.exercises.reduce((s, e) => s + e.kcal, 0) : 0;
  };
  const exerciseGoal = profile.dailyExerciseGoalKcal;
  const achievedOn = (dateKey: string) => exerciseGoal > 0 && exerciseKcalOn(dateKey) >= exerciseGoal;
  const todayAchieved = achievedOn(today);
  let streakDays = 0;
  for (let d = todayAchieved ? today : shiftDateKey(today, -1); achievedOn(d); d = shiftDateKey(d, -1)) streakDays += 1;
  const weekAchievedDays = Array.from({ length: 7 }, (_, i) => shiftDateKey(today, -i)).filter(achievedOn).length;
  const startWeightKg = weights.length > 0 ? weights[0].weightKg : null;

  /** 예상 달성일용 실제 페이스: 어제까지 최근 7일 중 먹은 걸 기록한 날의 하루 평균 적자 (소모 − 먹은 양).
   * 오늘은 아직 다 안 먹어서 빼고, 먹은 기록이 없는 날은 모르니 뺀다 */
  const paceDays = Array.from({ length: 7 }, (_, i) => recent.find((x) => x.date === shiftDateKey(today, -(i + 1))))
    .filter((d): d is DietDay => !!d && d.meals.length > 0);
  const actualDailyDeficit =
    base != null && paceDays.length >= 3
      ? paceDays.reduce(
          (s, d) =>
            s + base + dailyActivityKcal + d.exercises.reduce((a, e) => a + e.kcal, 0) - d.meals.reduce((a, m) => a + m.kcal, 0),
          0
        ) / paceDays.length
      : null;

  /** 오늘 목표 적자까지 더 써야 하는 칼로리 (음수면 이미 달성) */
  const needMore = balance != null ? balance + deficitTarget : null;

  const addMealItems = (meal: MealType, items: DietFood[]) => {
    if (!day) return;
    const added: MealEntry[] = items.map((i) => ({ id: genDietId(), meal, name: i.name, kcal: i.kcal }));
    update({ ...day, meals: [...day.meals, ...added] });
    let list = foods;
    items.forEach((i) => {
      list = rememberDietFood(i);
    });
    setFoods(list);
  };

  const addExercise = (entry: Omit<ExerciseEntry, "id">) => {
    if (!day) return;
    update({ ...day, exercises: [...day.exercises, { ...entry, id: genDietId() }] });
  };

  const saveWeightFor = (dateKey: string, kg: number | null) => {
    if (dateKey === date && day) {
      update({ ...day, weightKg: kg });
      setWeightInput(kg != null ? String(kg) : "");
      return;
    }
    // 다른 날짜를 보고 있을 때 설정에서 몸무게를 바꾸면 오늘 기록에 저장
    loadDietDay(dateKey).then(({ day: d }) => saveDietDay({ ...d, weightKg: kg }).then(refreshWeights));
  };

  const isToday = date === todayDateKey();
  const minutesPreset = [20, 30, 40, 50, 60];

  const tmMin = Number(tmMinutes) || 0;
  const tmPreview = weightNow && speed > 0 && tmMin > 0 ? treadmillKcal(weightNow, speed, incline, tmMin) : null;
  /** 운동 탭 툴팁: 이 운동을 하면 몸이 어떻게 바뀌는지 짧게 */
  const exerciseTips: Partial<Record<ExerciseTab, string[]>> = {
    treadmill: ["살이 쭉쭉 빠짐", "하체 근력 튼튼해짐", "체력 좋아짐"],
    pushup: ["가슴 두꺼워짐", "팔뚝 탄탄해짐", "요요 막아줌"],
    pullup: ["코어 강화, 복근도 생김", "어깨 넓어짐", "굽은 어깨 펴짐"],
  };

  /** 팔굽혀펴기·턱걸이 입력 폼 (횟수 → 칼로리) */
  const renderRepsForm = (kind: RepsExercise) => {
    const ex = REPS_EXERCISES[kind];
    const value = repsInput[kind];
    const n = Number(value) || 0;
    const preview = weightNow && n > 0 ? ex.kcal(weightNow, n) : null;
    const setValue = (v: string) => setRepsInput((r) => ({ ...r, [kind]: v }));
    return (
      <div className="space-y-3">
        <label className="flex items-center gap-1.5 text-[15px] text-neutral-600">
          횟수
          <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} w-20 text-right`} />회
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ex.presets.map((r) => (
            <button key={r} type="button" onClick={() => setValue(String(r))} className={chipClass(value === String(r))}>
              {r}회
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] text-neutral-700">
            {preview != null ? (
              <>
                약 <b className="tabular-nums text-neutral-900">{fmt(preview)}kcal</b>
                <span className="ml-1.5 text-xs text-neutral-400">(추정치)</span>
              </>
            ) : (
              <span className="text-sm text-neutral-400">몸무게를 설정하면 계산돼요</span>
            )}
          </p>
          <button
            type="button"
            disabled={preview == null}
            onClick={() => preview != null && addExercise({ type: kind, name: ex.name, reps: n, kcal: Math.round(preview) })}
            className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-[15px] font-semibold text-white hover:bg-neutral-700 disabled:opacity-30"
          >
            추가
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-4 pb-6 md:space-y-6">
      <SectionTitle title="다이어트" subtitle="먹은 것과 운동을 적으면 칼로리와 체중 변화를 계산해요." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDateKey(d, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
            aria-label="이전 날"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[8.5rem] text-center text-lg font-bold text-neutral-900">{dateLabel(date)}</span>
          <button
            type="button"
            onClick={() => setDate((d) => shiftDateKey(d, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
            aria-label="다음 날"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayDateKey())}
              className="ml-1 rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200"
            >
              오늘
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <Settings className="h-4 w-4 text-neutral-500" aria-hidden />
          키·몸무게·목표 설정
        </button>
      </div>

      {source === "local" && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          아직 서버 저장 공간이 없어서 이 기기에만 저장돼요. Supabase에서 <code className="rounded bg-amber-100 px-1">supabase/migration-diet.sql</code>을 실행하면 폰·PC가 동기화돼요.
        </p>
      )}

      {!ready && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="w-full rounded-2xl bg-neutral-900 px-5 py-4 text-left text-[15px] font-medium text-white"
        >
          성별·나이·키·몸무게를 입력하면 칼로리 계산이 시작돼요 →
        </button>
      )}

      <DietGoalPanel
        targetWeightKg={profile.targetWeightKg}
        weeklyLossKg={profile.weeklyLossKg}
        startWeightKg={startWeightKg}
        currentWeightKg={weightNow}
        dayLabel={date === today ? "오늘" : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`}
        dayIsPast={date < today}
        dayExerciseKcal={exerciseKcalOn(date)}
        dayAchieved={achievedOn(date)}
        exerciseGoalKcal={exerciseGoal}
        streakDays={streakDays}
        todayAchieved={todayAchieved}
        weekAchievedDays={weekAchievedDays}
        actualDailyDeficit={actualDailyDeficit}
        paceDayCount={paceDays.length}
        treadmillMinutesFor={(kcal) => (kcalPerMin > 0 ? kcal / kcalPerMin : null)}
        treadmillLabel={`트레드밀 ${incline}%·${speed}km/h`}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* 오늘 요약: 먹은 양 / 먹어도 되는 양 게이지 */}
      <section className={cardClass}>
        {(() => {
          const allowed = burn != null ? burn - deficitTarget : null;
          const over = needMore != null && needMore > 0;
          const pct = allowed != null && allowed > 0 ? Math.min(100, (intake / allowed) * 100) : 0;
          return (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-500">오늘 먹은 양</p>
                  <p className="mt-1 tabular-nums">
                    <span className="text-4xl font-bold text-neutral-900 md:text-5xl">{fmt(intake)}</span>
                    <span className="ml-1.5 text-base text-neutral-400">{allowed != null ? `/ ${fmt(allowed)} kcal` : "kcal"}</span>
                  </p>
                </div>
              </div>
              {allowed != null && (
                <>
                  <div className="mt-4 h-3.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-neutral-900"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-neutral-500">
                    <span>주 {profile.weeklyLossKg}kg 감량 목표 기준</span>
                    <span className={over ? "font-semibold text-red-600" : ""}>
                      {over
                        ? kcalPerMin > 0
                          ? `트레드밀 ${incline}%·${speed}km/h ${fmt(needMore! / kcalPerMin)}분 하면 만회`
                          : `${fmt(needMore!)}kcal 더 써야 해요`
                        : "더 해야 할 운동 없음"}
                    </span>
                  </div>
                </>
              )}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-4 text-center">
                <div>
                  <p className="text-xs text-neutral-400 md:text-sm">쓴 칼로리</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{burn != null ? fmt(burn) : "–"}</p>
                  {base != null && (
                    <p className="text-[11px] tabular-nums text-neutral-400">
                      기본 {fmt(base)}
                      {profile.dailyActivities.length > 0 && ` + 매일 ${fmt(dailyActivityKcal)}`}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-neutral-400 md:text-sm">운동</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{fmt(exerciseKcal)}kcal</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 md:text-sm">예상 변화</p>
                  <p
                    className={`mt-0.5 text-lg font-bold tabular-nums ${
                      balance == null ? "text-neutral-900" : balance > 0 ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {balance != null ? `${balance > 0 ? "+" : "−"}${fmt(Math.abs(kcalToGrams(balance)))}g` : "–"}
                  </p>
                </div>
              </div>
            </>
          );
        })()}
      </section>

      {/* 먹은 것 */}
      <section className={cardClass}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-neutral-900">먹은 것</h2>
          <span className="text-sm tabular-nums text-neutral-500">하루 {fmt(intake)}kcal</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* 아침 칸은 숨김. 예전에 아침으로 적은 날만 보여줘서 합계에 들어간 칼로리가 안 보이는 일이 없게 */}
          {MEAL_TYPES.filter((m) => m.id !== "breakfast" || meals.some((e) => e.meal === "breakfast")).map((m) => (
            <MealBlock
              key={m.id}
              meal={m.id}
              label={m.label}
              entries={meals.filter((e) => e.meal === m.id)}
              foods={foodsByFrequency}
              combos={combos}
              onAdd={(items) => addMealItems(m.id, items)}
              onRemove={(id) => day && update({ ...day, meals: day.meals.filter((e) => e.id !== id) })}
              onSaveCombo={(name, items) => {
                const next = [{ id: genDietId(), name, items }, ...combos];
                saveDietCombos(next);
                setCombos(next);
              }}
            />
          ))}
        </div>
      </section>

      {/* 운동 */}
      <section className={cardClass}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-neutral-900">운동</h2>
          <span className="text-sm tabular-nums text-neutral-500">{fmt(dailyActivityKcal + exerciseKcal)}kcal 소모</span>
        </div>


        {/* relative: 폰에서 툴팁을 버튼 줄 기준으로 펼침 */}
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {(
            [
              ["treadmill", "트레드밀"],
              ["pushup", "팔굽혀펴기"],
              ["pullup", "턱걸이"],
              ["custom", "기타"],
            ] as const
          ).map(([id, label], i) => {
            const tip = exerciseTips[id];
            return (
              <div key={id} data-exercise-tab className="group md:relative">
                <button
                  type="button"
                  onClick={() => {
                    setExTab(id);
                    setTipFor(tip ? id : null);
                  }}
                  className={chipClass(exTab === id)}
                >
                  {label}
                </button>
                {/* 운동 효과: PC는 마우스 올리면, 폰은 누르면 잠깐 */}
                {tip && (
                  <div
                    // 안 보일 땐 hidden(자리도 안 차지해 폰 화면이 옆으로 안 넘침).
                    // 폰: 버튼 줄 왼쪽 기준. PC: 각 버튼 위(오른쪽 버튼은 오른쪽 기준)
                    className={`pointer-events-none absolute bottom-full left-0 z-30 mb-2.5 whitespace-nowrap rounded-2xl bg-neutral-900 px-4 py-3 text-base font-bold leading-relaxed text-[#FFB25C] shadow-xl md:text-lg md:group-hover:block ${
                      i >= 2 ? "md:left-auto md:right-0" : "md:left-0"
                    } ${tipFor === id ? "block" : "hidden"}`}
                    role="tooltip"
                  >
                    {tip.map((line) => (
                      <p key={line}>✓ {line}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
          {exTab === "treadmill" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[15px] text-neutral-600">
                <label className="flex items-center gap-1.5">
                  경사
                  <input inputMode="decimal" value={tmIncline} onChange={(e) => setTmIncline(e.target.value)} className={`${inputClass} w-16 text-right`} />%
                </label>
                <label className="flex items-center gap-1.5">
                  속도
                  <input inputMode="decimal" value={tmSpeed} onChange={(e) => setTmSpeed(e.target.value)} className={`${inputClass} w-16 text-right`} />
                  km/h
                </label>
                <label className="flex items-center gap-1.5">
                  시간
                  <input inputMode="numeric" value={tmMinutes} onChange={(e) => setTmMinutes(e.target.value)} className={`${inputClass} w-16 text-right`} />분
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {minutesPreset.map((m) => (
                  <button key={m} type="button" onClick={() => setTmMinutes(String(m))} className={chipClass(tmMinutes === String(m))}>
                    {m}분
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] text-neutral-700">
                  {tmPreview != null ? (
                    <>
                      약 <b className="tabular-nums text-neutral-900">{fmt(tmPreview)}kcal</b>
                      <span className="ml-1.5 text-xs text-neutral-400">(분당 {kcalPerMin.toFixed(1)}kcal)</span>
                    </>
                  ) : (
                    <span className="text-sm text-neutral-400">몸무게를 설정하면 계산돼요</span>
                  )}
                </p>
                <button
                  type="button"
                  disabled={tmPreview == null}
                  onClick={() =>
                    tmPreview != null &&
                    addExercise({ type: "treadmill", name: "트레드밀", minutes: tmMin, incline, speed, kcal: Math.round(tmPreview) })
                  }
                  className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-[15px] font-semibold text-white hover:bg-neutral-700 disabled:opacity-30"
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {(exTab === "pushup" || exTab === "pullup") && renderRepsForm(exTab)}

          {exTab === "custom" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const k = Number(customKcal);
                if (!customName.trim() || customKcal.trim() === "" || Number.isNaN(k)) return;
                addExercise({ type: "custom", name: customName.trim(), kcal: k });
                setCustomName("");
                setCustomKcal("");
              }}
            >
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="운동 (예: 자전거 30분)" className={`${inputClass} flex-1`} />
              <input inputMode="numeric" value={customKcal} onChange={(e) => setCustomKcal(e.target.value)} placeholder="kcal" className={`${inputClass} w-20 text-right`} />
              <button type="submit" className="shrink-0 rounded-xl bg-neutral-900 px-3 text-[15px] font-semibold text-white hover:bg-neutral-700">
                추가
              </button>
            </form>
          )}
        </div>

        {exercises.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-100">
            {exercises.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-800">
                  {e.type === "treadmill"
                    ? `트레드밀 ${e.incline}% · ${e.speed}km/h · ${e.minutes}분`
                    : e.type === "pushup" || e.type === "pullup"
                      ? `${e.name} ${e.reps}회`
                      : e.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-neutral-500">{fmt(e.kcal)}kcal</span>
                <button
                  type="button"
                  onClick={() => day && update({ ...day, exercises: day.exercises.filter((x) => x.id !== e.id) })}
                  className="shrink-0 rounded-md px-1.5 text-lg leading-none text-neutral-300 transition hover:text-red-500"
                  aria-label="운동 빼기"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 기록: 몸무게·먹은 칼로리·운동을 날짜별로 */}
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-neutral-900">기록</h2>
          <div className="flex flex-wrap gap-1.5">
            {HISTORY_RANGES.map((r) => (
              <button key={r.id} type="button" onClick={() => setHistoryRange(r.id)} className={chipClass(historyRange === r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto border-b border-neutral-100 scrollbar-hide">
          {HISTORY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setHistoryTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-[15px] font-medium transition ${
                historyTab === t.id ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {historyTab === "weight" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const kg = weightInput.trim() === "" ? null : Number(weightInput);
                    if (kg != null && (Number.isNaN(kg) || kg <= 0)) return;
                    saveWeightFor(date, kg);
                  }}
                >
                  <span className="text-[15px] text-neutral-600">{isToday ? "오늘" : dateLabel(date)}</span>
                  <input
                    inputMode="decimal"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder={weightNow != null ? String(weightNow) : "kg"}
                    className={`${inputClass} w-24 text-right`}
                    aria-label="몸무게"
                  />
                  <span className="text-[15px] text-neutral-600">kg</span>
                  <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-[15px] font-semibold text-white hover:bg-neutral-700">
                    기록
                  </button>
                </form>
                {bmr != null && bmi != null && (
                  <span className="text-sm tabular-nums text-neutral-500">
                    기초대사량 {fmt(bmr)}kcal · BMI {bmi.toFixed(1)} {bmiLabel(bmi)}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <WeightChart points={weights.filter((w) => w.date >= historyDates[0])} targetKg={profile.targetWeightKg} />
              </div>
            </>
          )}

          {historyTab === "intake" && (
            <>
              <p className="text-sm tabular-nums text-neutral-500">
                기록한 날 {intakeStats.days}일
                {intakeStats.days > 0 && ` · 하루 평균 ${fmt(intakeStats.avg)}kcal`}
              </p>
              <div className="mt-3">
                <DailyBarChart
                  dates={historyDates}
                  values={intakeByDate}
                  unit="kcal"
                  target={ready ? targetIntake : null}
                  targetLabel="목표 섭취"
                  emptyText="먹은 것을 기록하면 날짜별로 여기에 쌓여요."
                />
              </div>
            </>
          )}

          {historyTab === "exercise" && (
            <>
              <p className="text-sm tabular-nums text-neutral-500">
                운동한 날 {exerciseStats.days}일
                {exerciseStats.days > 0 && ` · 총 ${fmt(exerciseStats.kcal)}kcal`}
                {exerciseStats.treadmillMin > 0 && ` · 트레드밀 ${fmt(exerciseStats.treadmillMin)}분`}
                {exerciseStats.pushups > 0 && ` · 팔굽혀펴기 ${fmt(exerciseStats.pushups)}회`}
                {exerciseStats.pullups > 0 && ` · 턱걸이 ${fmt(exerciseStats.pullups)}회`}
              </p>
              <div className="mt-3">
                <DailyBarChart
                  dates={historyDates}
                  values={exerciseByDate}
                  unit="kcal"
                  color="#F19E36"
                  emptyText="운동을 기록하면 날짜별로 여기에 쌓여요."
                />
              </div>
            </>
          )}

          {historyTab === "table" &&
            (tableRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">기록한 날이 없어요.</p>
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[420px] text-[15px] tabular-nums">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                      <th className="px-1 py-2 font-medium">날짜</th>
                      <th className="px-1 py-2 text-right font-medium">먹은</th>
                      <th className="px-1 py-2 text-right font-medium">운동</th>
                      <th className="px-1 py-2 text-right font-medium">몸무게</th>
                      <th className="px-1 py-2 text-right font-medium">예상 변화</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr
                        key={r.date}
                        onClick={() => setDate(r.date)}
                        className={`cursor-pointer border-b border-neutral-50 transition hover:bg-neutral-50 ${r.date === date ? "bg-neutral-50" : ""}`}
                        title="이 날짜로 이동"
                      >
                        <td className="px-1 py-2 text-neutral-700">{dateLabel(r.date)}</td>
                        <td className="px-1 py-2 text-right text-neutral-900">{r.intake > 0 ? fmt(r.intake) : "–"}</td>
                        <td className="px-1 py-2 text-right text-neutral-900">{r.exercise > 0 ? fmt(r.exercise) : "–"}</td>
                        <td className="px-1 py-2 text-right text-neutral-900">{r.weight != null ? `${r.weight}kg` : "–"}</td>
                        <td
                          className={`px-1 py-2 text-right ${
                            r.grams == null ? "text-neutral-300" : r.grams > 0 ? "text-red-500" : "text-emerald-600"
                          }`}
                        >
                          {r.grams == null ? "–" : `${r.grams > 0 ? "+" : "−"}${fmt(Math.abs(r.grams))}g`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-neutral-400">예상 변화는 먹은 것을 기록한 날만, 지금 몸무게·설정 기준으로 계산해요. 줄을 누르면 그날로 이동해요.</p>
              </div>
            ))}
        </div>
      </section>

      {settingsOpen && (
        <DietSettingsModal
          currentWeightKg={weightNow}
          onSaveWeight={(kg) => saveWeightFor(todayDateKey(), kg)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
