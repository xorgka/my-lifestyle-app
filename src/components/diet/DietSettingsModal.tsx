"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  type DailyActivity,
  type DietCombo,
  type DietFood,
  type DietProfile,
  genDietId,
  getDietCombos,
  getDietFoods,
  getDietProfile,
  saveDietCombos,
  saveDietFoods,
  saveDietProfile,
} from "@/lib/dietDb";
import { bmiLabel, calcBmi, calcBmr, calcDailyBase, dailyDeficitTarget, treadmillKcalPerMin, walkKcal, type Sex } from "@/lib/dietCalc";

const inputClass =
  "w-full min-w-0 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[15px] text-neutral-900 tabular-nums focus:border-neutral-400 focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-neutral-600";

const WEEKLY_LOSS_OPTIONS = [0.25, 0.5, 0.75, 1];

const TABS = [
  { id: "profile", label: "내 정보" },
  { id: "goal", label: "목표" },
  { id: "exercise", label: "운동·활동" },
  { id: "food", label: "식단" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** 빈 칸이면 null, 숫자가 아니면 null */
function toNum(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

/** 키·나이·성별·몸무게·목표·트레드밀 기본값 + 음식 목록/자주 먹는 조합 관리 */
export function DietSettingsModal({
  currentWeightKg,
  onSaveWeight,
  onClose,
}: {
  currentWeightKg: number | null;
  /** 몸무게가 바뀌면 오늘 날짜로 기록 */
  onSaveWeight: (kg: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<DietProfile>(() => getDietProfile());
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? "");
  const [age, setAge] = useState(profile.age?.toString() ?? "");
  const [weight, setWeight] = useState(currentWeightKg?.toString() ?? "");
  const [target, setTarget] = useState(profile.targetWeightKg?.toString() ?? "");
  const [incline, setIncline] = useState(profile.treadmillIncline.toString());
  const [speed, setSpeed] = useState(profile.treadmillSpeed.toString());
  const [exerciseGoal, setExerciseGoal] = useState(profile.dailyExerciseGoalKcal.toString());
  const [foods, setFoods] = useState<DietFood[]>(() => getDietFoods());
  const [combos, setCombos] = useState<DietCombo[]>(() => getDietCombos());
  const [activities, setActivities] = useState<DailyActivity[]>(profile.dailyActivities);

  const updateActivity = (id: string, patch: Partial<DailyActivity>) =>
    setActivities((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const h = toNum(height);
  const a = toNum(age);
  const w = toNum(weight);
  const preview =
    profile.sex && h && a && w
      ? (() => {
          const bmr = calcBmr(profile.sex, w, h, a);
          const bmi = calcBmi(w, h);
          return { bmr, base: calcDailyBase(bmr), bmi };
        })()
      : null;

  const handleSave = () => {
    const next: DietProfile = {
      ...profile,
      heightCm: h,
      age: a,
      targetWeightKg: toNum(target),
      treadmillIncline: toNum(incline) ?? profile.treadmillIncline,
      treadmillSpeed: toNum(speed) ?? profile.treadmillSpeed,
      dailyExerciseGoalKcal: toNum(exerciseGoal) ?? profile.dailyExerciseGoalKcal,
      dailyActivities: activities.filter((a) => a.name.trim() && a.minutes > 0 && a.speedKmh > 0).map((a) => ({ ...a, name: a.name.trim() })),
    };
    saveDietProfile(next);
    saveDietFoods(foods);
    saveDietCombos(combos);
    if (w != null && w !== currentWeightKg) onSaveWeight(w);
    onClose();
  };

  const sexButton = (value: Sex, label: string) => (
    <button
      type="button"
      onClick={() => setProfile((p) => ({ ...p, sex: value }))}
      className={`flex-1 rounded-xl border px-3 py-2.5 text-[15px] font-medium transition ${
        profile.sex === value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {label}
    </button>
  );

  const tabButton = (t: (typeof TABS)[number], mobile: boolean) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setTab(t.id)}
      className={
        mobile
          ? `shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === t.id ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"}`
          : `px-5 py-2.5 text-left text-sm transition ${
              tab === t.id
                ? "border-r-2 border-neutral-800 bg-white font-medium text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-800"
            }`
      }
    >
      {t.label}
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="다이어트 설정"
    >
      {/* 높이 고정: 탭을 바꿔도 창 크기가 튀지 않게, 내용은 안에서 스크롤. my-auto는 창보다 작을 때 가운데 */}
      <div
        className="my-auto flex h-[min(640px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* PC: 왼쪽 메뉴 */}
        <nav className="hidden w-40 shrink-0 flex-col border-r border-neutral-100 bg-neutral-50/80 py-5 sm:flex">
          <h2 className="px-5 pb-3 font-semibold text-neutral-900">다이어트 설정</h2>
          {TABS.map((t) => tabButton(t, false))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 모바일: 위쪽 가로 메뉴 */}
          <div className="shrink-0 border-b border-neutral-100 px-6 pt-5 sm:hidden">
            <h2 className="font-semibold text-neutral-900">다이어트 설정</h2>
            <div className="-mx-6 flex gap-2 overflow-x-auto px-6 py-3 scrollbar-hide">{TABS.map((t) => tabButton(t, true))}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {tab === "profile" && (
              <>
              <section className="space-y-4">
                <div>
                  <span className={labelClass}>성별</span>
                  <div className="flex gap-2">
                    {sexButton("male", "남성")}
                    {sexButton("female", "여성")}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <label>
                    <span className={labelClass}>나이</span>
                    <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="35" className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>키 (cm)</span>
                    <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>몸무게 (kg)</span>
                    <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" className={inputClass} />
                  </label>
                </div>
                <p className="-mt-1 text-xs text-neutral-400">몸무게를 바꾸면 오늘 날짜로 기록돼요. 기록이 쌓이면 추이 그래프로 보여요.</p>
                {preview && (
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-neutral-50 p-3 text-center">
                    <div>
                      <p className="text-xs text-neutral-500">기초대사량</p>
                      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-neutral-900">{Math.round(preview.bmr).toLocaleString()}kcal</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">하루 소모 (운동 제외)</p>
                      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-neutral-900">{Math.round(preview.base).toLocaleString()}kcal</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">BMI</p>
                      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-neutral-900">
                        {preview.bmi.toFixed(1)} <span className="text-xs font-medium text-neutral-500">{bmiLabel(preview.bmi)}</span>
                      </p>
                    </div>
                  </div>
                )}
              </section>
              </>
            )}
            {tab === "goal" && (
              <>
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-800">목표</h3>
                <label className="block">
                  <span className={labelClass}>목표 몸무게 (kg)</span>
                  <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="70" className={inputClass} />
                </label>
                <div>
                  <span className={labelClass}>일주일에 빼는 양</span>
                  <div className="grid grid-cols-4 gap-2">
                    {WEEKLY_LOSS_OPTIONS.map((kg) => (
                      <button
                        key={kg}
                        type="button"
                        onClick={() => setProfile((p) => ({ ...p, weeklyLossKg: kg }))}
                        className={`rounded-xl border px-2 py-2.5 text-[15px] font-medium tabular-nums transition ${
                          profile.weeklyLossKg === kg ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {kg}kg
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-400">
                    하루 약 {Math.round(dailyDeficitTarget(profile.weeklyLossKg)).toLocaleString()}kcal 덜 먹거나 더 써야 해요. 0.5kg이 무리 없는 속도예요.
                  </p>
                </div>
              </section>
              </>
            )}
            {tab === "exercise" && (
              <>
              <section>
                <h3 className="text-sm font-semibold text-neutral-800">하루 운동 목표</h3>
                <p className="mt-1 text-xs text-neutral-400">그날 운동 칼로리가 이걸 넘으면 달성으로 쳐서, 연속 달성 일수를 세요. 매일 하는 활동(산책)은 빼고 계산해요.</p>
                <div className="mt-3 flex items-center gap-2">
                  <input inputMode="numeric" value={exerciseGoal} onChange={(e) => setExerciseGoal(e.target.value)} className={`${inputClass} w-28 text-right`} />
                  <span className="text-[15px] text-neutral-600">kcal</span>
                  {w != null && toNum(exerciseGoal) && toNum(speed) ? (
                    <span className="text-sm tabular-nums text-neutral-400">
                      ≈ 트레드밀 {toNum(incline) ?? 0}%·{toNum(speed)}km/h{" "}
                      {Math.round((toNum(exerciseGoal) ?? 0) / Math.max(0.1, treadmillKcalPerMin(w, toNum(speed) ?? 0, toNum(incline) ?? 0)))}분
                    </span>
                  ) : null}
                </div>
              </section>
              <section className="mt-6 border-t border-neutral-100 pt-5">
                <h3 className="text-sm font-semibold text-neutral-800">매일 하는 활동</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  매일 자동으로 소모 칼로리에 들어가요. 앉아서 일하는 건 이미 기본 소모량에 포함돼 있어서 넣지 않아도 돼요.
                </p>
                <ul className="mt-3 space-y-2">
                  {activities.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                      <input
                        value={a.name}
                        onChange={(e) => updateActivity(a.id, { name: e.target.value })}
                        placeholder="활동 (예: 강아지 산책)"
                        className="min-w-0 flex-1 basis-40 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[15px] focus:border-neutral-400 focus:outline-none"
                      />
                      <input
                        inputMode="numeric"
                        value={a.minutes || ""}
                        onChange={(e) => updateActivity(a.id, { minutes: toNum(e.target.value) ?? 0 })}
                        className="w-14 rounded-lg border border-neutral-200 px-2 py-1.5 text-right text-[15px] tabular-nums focus:border-neutral-400 focus:outline-none"
                        aria-label="시간(분)"
                      />
                      분 · 걷기
                      <input
                        inputMode="decimal"
                        value={a.speedKmh || ""}
                        onChange={(e) => updateActivity(a.id, { speedKmh: toNum(e.target.value) ?? 0 })}
                        className="w-14 rounded-lg border border-neutral-200 px-2 py-1.5 text-right text-[15px] tabular-nums focus:border-neutral-400 focus:outline-none"
                        aria-label="걷기 속도(km/h)"
                      />
                      km/h
                      {w != null && a.minutes > 0 && a.speedKmh > 0 && (
                        <span className="tabular-nums text-neutral-400">≈ {Math.round(walkKcal(w, a.speedKmh, a.minutes))}kcal</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setActivities((list) => list.filter((x) => x.id !== a.id))}
                        className="ml-auto rounded-lg px-2 py-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setActivities((list) => [...list, { id: genDietId(), name: "", minutes: 30, speedKmh: 4 }])}
                  className="mt-2 rounded-lg px-2 py-1 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
                >
                  + 활동 추가
                </button>
                <p className="mt-1 text-xs text-neutral-400">걷기 속도: 느긋한 산책 3~3.5, 보통 걸음 4~5km/h</p>
              </section>
              <section className="mt-6 space-y-3 border-t border-neutral-100 pt-5">
                <h3 className="text-sm font-semibold text-neutral-800">트레드밀 기본값</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className={labelClass}>경사 (%)</span>
                    <input inputMode="decimal" value={incline} onChange={(e) => setIncline(e.target.value)} className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>속도 (km/h)</span>
                    <input inputMode="decimal" value={speed} onChange={(e) => setSpeed(e.target.value)} className={inputClass} />
                  </label>
                </div>
              </section>
              </>
            )}
            {tab === "food" && (
              <>
              <section>
                <h3 className="text-sm font-semibold text-neutral-800">자주 먹는 조합</h3>
                {combos.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-400">끼니에 음식을 넣고 "조합으로 저장"을 누르면 여기에 생겨요.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-neutral-100">
                    {combos.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium text-neutral-800">{c.name}</p>
                          <p className="truncate text-xs text-neutral-400">
                            {c.items.map((i) => i.name).join(" + ")} · {c.items.reduce((s, i) => s + i.kcal, 0).toLocaleString()}kcal
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCombos((list) => list.filter((x) => x.id !== c.id))}
                          className="shrink-0 rounded-lg px-2 py-1 text-sm text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="mt-6 border-t border-neutral-100 pt-5">
                <h3 className="text-sm font-semibold text-neutral-800">음식 칼로리 목록</h3>
                {foods.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-400">음식을 한 번 적으면 여기에 기억돼서, 다음부터 이름만 치면 칼로리가 채워져요.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-neutral-100">
                    {foods.map((f) => (
                      <li key={f.name} className="flex items-center gap-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-800">{f.name}</span>
                        <input
                          inputMode="numeric"
                          value={f.kcal}
                          onChange={(e) => {
                            const kcal = toNum(e.target.value) ?? 0;
                            setFoods((list) => list.map((x) => (x.name === f.name ? { ...x, kcal } : x)));
                          }}
                          className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-right text-sm tabular-nums focus:border-neutral-400 focus:outline-none"
                          aria-label={`${f.name} 칼로리`}
                        />
                        <span className="text-xs text-neutral-400">kcal</span>
                        <button
                          type="button"
                          onClick={() => setFoods((list) => list.filter((x) => x.name !== f.name))}
                          className="rounded-lg px-2 py-1 text-sm text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              </>
            )}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[15px] font-medium text-neutral-500 hover:bg-neutral-100">
              취소
            </button>
            <button type="button" onClick={handleSave} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-neutral-700">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
