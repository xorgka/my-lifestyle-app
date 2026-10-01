/**
 * 다이어트 계산: 기초대사량·하루 소모량·BMI·운동 칼로리·목표 안내.
 * 운동 칼로리는 "가만히 있을 때보다 추가로 쓴 칼로리(순 소모)"로 계산한다.
 * 하루 소모량(기초대사량 × 생활 활동)에 쉬는 동안의 소모가 이미 들어 있어서, 운동의 총 소모를 더하면 두 번 계산되기 때문.
 */

export type Sex = "male" | "female";

/** 지방 1kg ≈ 7,700kcal */
export const KCAL_PER_KG = 7700;

/** 운동을 뺀 평소 생활 활동 계수 (주로 앉아서 생활). 운동은 따로 기록하므로 낮게 잡음 */
export const LIFESTYLE_FACTOR = 1.2;

/** 기초대사량 (Mifflin-St Jeor 공식) */
export function calcBmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/** 운동을 뺀 하루 소모량 = 기초대사량 × 생활 활동 계수 */
export function calcDailyBase(bmr: number): number {
  return bmr * LIFESTYLE_FACTOR;
}

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** 대한비만학회 기준 */
export function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return "저체중";
  if (bmi < 23) return "정상";
  if (bmi < 25) return "비만 전 단계";
  if (bmi < 30) return "1단계 비만";
  if (bmi < 35) return "2단계 비만";
  return "3단계 비만";
}

/**
 * 트레드밀 순 소모 kcal/분 (ACSM 대사 공식).
 * 걷기(시속 6km 이하): VO2 = 0.1·속도 + 1.8·속도·경사 + 3.5
 * 달리기: VO2 = 0.2·속도 + 0.9·속도·경사 + 3.5   (속도 m/분, 경사 0~1, VO2 ml/kg/분)
 * 1L 산소 ≈ 5kcal. 쉬는 몫 3.5를 빼서 순 소모로.
 */
export function treadmillKcalPerMin(weightKg: number, speedKmh: number, inclinePct: number): number {
  const speed = (speedKmh * 1000) / 60;
  const grade = inclinePct / 100;
  const walking = speedKmh <= 6;
  const vo2 = walking ? 0.1 * speed + 1.8 * speed * grade + 3.5 : 0.2 * speed + 0.9 * speed * grade + 3.5;
  const netVo2 = Math.max(0, vo2 - 3.5);
  return (netVo2 * weightKg * 5) / 1000;
}

export function treadmillKcal(weightKg: number, speedKmh: number, inclinePct: number, minutes: number): number {
  return treadmillKcalPerMin(weightKg, speedKmh, inclinePct) * minutes;
}

/** 운동 강도 (METs). 맨몸운동 기준: 가벼움 2.8 · 보통 3.8 · 힘듦 8 */
export const EXERCISE_INTENSITIES = [
  { met: 2.8, label: "가벼움" },
  { met: 3.8, label: "보통" },
  { met: 8, label: "힘듦" },
] as const;

/**
 * 설정에서 만든 운동(팔굽혀펴기·풀업·데드행 등)의 순 소모 (추정치).
 * 순 소모 kcal/분 = (MET − 1) × 3.5 × 체중 / 200. 횟수 운동은 1회에 걸리는 시간으로 분을 구한다.
 */
export function definedExerciseKcal(
  ex: { unit: "reps" | "minutes"; met: number; secondsPerRep?: number },
  weightKg: number,
  amount: number
): number {
  const minutes = ex.unit === "reps" ? (amount * (ex.secondsPerRep ?? 3)) / 60 : amount;
  return (((ex.met - 1) * 3.5 * weightKg) / 200) * minutes;
}

/** 평지 걷기 순 소모 (강아지 산책 등 매일 하는 활동) */
export function walkKcal(weightKg: number, speedKmh: number, minutes: number): number {
  return treadmillKcal(weightKg, speedKmh, 0, minutes);
}

/** 주당 감량 목표(kg) → 하루에 만들어야 할 칼로리 적자 */
export function dailyDeficitTarget(weeklyLossKg: number): number {
  return (weeklyLossKg * KCAL_PER_KG) / 7;
}

/** 칼로리 차이 → 예상 체중 변화(g). +면 증가 */
export function kcalToGrams(kcal: number): number {
  return (kcal / KCAL_PER_KG) * 1000;
}
