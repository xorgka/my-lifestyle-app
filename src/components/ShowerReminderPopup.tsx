"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { todayStr } from "@/lib/dateUtil";

const SHOWER_ITEM_TITLE = "기상 후 샤워";
const STORAGE_KEY = "shower-reminder-last";
const THROTTLE_MS = 2 * 60 * 60 * 1000; // 2시간

const BENEFITS = [
  "뇌가 깨어나 인지기능 UP",
  "창의적 사고 촉진",
  "문제 해결능력 UP",
  "자는동안 쌓인 피지, 땀, 먼지 제거",
  "혈액순환 촉진으로 붓기 완화",
  "하루 시작을 알리는 신호!",
];

function getLastShown(): { date: string; time: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; time: number };
    return parsed && typeof parsed.date === "string" && typeof parsed.time === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function setLastShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr(), time: Date.now() }));
  } catch {}
}

export function ShowerReminderPopup() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "benefits" | "goodbye">("ask");
  const [itemId, setItemId] = useState<number | null>(null);
  const [showIcon, setShowIcon] = useState(false);

  const checkAndShow = useCallback(async () => {
    const today = todayStr();
    const [items, completions] = await Promise.all([loadRoutineItems(), loadRoutineCompletions()]);
    const showerItem = items.find((i) => i.title.trim() === SHOWER_ITEM_TITLE);
    if (!showerItem) return;
    const completedToday = (completions[today] ?? []).includes(showerItem.id);
    if (completedToday) return;

    const last = getLastShown();
    const now = Date.now();
    if (last && last.date === today && now - last.time < THROTTLE_MS) return;

    setItemId(showerItem.id);
    setStep("ask");
    setOpen(true);
    setLastShown();
  }, []);

  useEffect(() => {
    checkAndShow();
    const interval = setInterval(checkAndShow, THROTTLE_MS);
    return () => clearInterval(interval);
  }, [checkAndShow]);

  const handleYes = useCallback(async () => {
    if (itemId === null) return;
    await toggleRoutineCompletion(todayStr(), itemId, true);
    setOpen(false);
  }, [itemId]);

  const handleNo = useCallback(() => {
    setStep("benefits");
  }, []);

  const handleGood = useCallback(() => {
    setOpen(false);
    setShowIcon(true);
  }, []);

  useEffect(() => {
    if (!showIcon) return;
    const t = setTimeout(() => setShowIcon(false), 1800);
    return () => clearTimeout(t);
  }, [showIcon]);

  if (!open && !showIcon) return null;

  if (showIcon && typeof document !== "undefined" && document.body) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
        aria-hidden
      >
        <div className="shower-goodbye-icon text-[120px]">
          <span className="inline-block" role="img" aria-label="좋아요">
            👍
          </span>
        </div>
      </div>,
      document.body
    );
  }

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shower-reminder-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {step === "ask" && (
          <>
            <h2 id="shower-reminder-title" className="text-center text-lg font-semibold text-neutral-900">
              기상 후 샤워 하셨나요?
            </h2>
            <div className="mt-6 flex justify-center gap-4">
              <button
                type="button"
                onClick={handleYes}
                className="rounded-xl bg-neutral-800 px-6 py-3 text-base font-semibold text-white hover:bg-neutral-700"
              >
                O
              </button>
              <button
                type="button"
                onClick={handleNo}
                className="rounded-xl border-2 border-neutral-300 px-6 py-3 text-base font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                X
              </button>
            </div>
          </>
        )}
        {step === "benefits" && (
          <>
            <p className="mb-4 text-center text-sm font-medium text-neutral-600">
              지금 샤워를 하면,
            </p>
            <ul className="space-y-2 text-sm text-neutral-800">
              {BENEFITS.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleGood}
              className="mt-6 w-full rounded-xl bg-neutral-800 py-3 text-base font-semibold text-white hover:bg-neutral-700"
            >
              좋아!
            </button>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" && document.body ? createPortal(modal, document.body) : null;
}
