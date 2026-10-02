"use client";

import { useCallback, useEffect, useState } from "react";
import { KCAL_PER_KG } from "@/lib/dietCalc";

/** 예상 변화를 보여주는 단위: 칼로리(기본) 또는 지방으로 환산한 kg */
export type ChangeUnit = "kcal" | "kg";

const STORAGE_KEY = "diet-change-unit";
const CHANGED_EVENT = "diet-change-unit-changed";

function readUnit(): ChangeUnit {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "kg" ? "kg" : "kcal";
  } catch {
    return "kcal";
  }
}

/**
 * 예상 변화 숫자를 누르면 kcal ↔ kg으로 바뀐다. 고른 단위는 이 기기에 기억하고,
 * 같은 화면의 다른 숫자(목표 패널·표·홈 카드)도 같이 바뀐다.
 */
export function useChangeUnit(): [ChangeUnit, () => void] {
  const [unit, setUnit] = useState<ChangeUnit>("kcal");
  useEffect(() => {
    const sync = () => setUnit(readUnit());
    sync();
    window.addEventListener(CHANGED_EVENT, sync);
    return () => window.removeEventListener(CHANGED_EVENT, sync);
  }, []);
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, readUnit() === "kg" ? "kcal" : "kg");
    } catch {}
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  }, []);
  return [unit, toggle];
}

/** 부호를 붙인 숫자만 (단위 제외): kcal이면 "+1,121", kg이면 "+0.15". +는 찌는 쪽 */
export function formatChange(kcal: number, unit: ChangeUnit): string {
  const sign = kcal > 0 ? "+" : "−";
  const abs = Math.abs(kcal);
  return sign + (unit === "kg" ? (abs / KCAL_PER_KG).toFixed(2) : Math.round(abs).toLocaleString());
}
