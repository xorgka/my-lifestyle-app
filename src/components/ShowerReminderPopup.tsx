"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { getReminderLastShown, setReminderLastShown } from "@/lib/reminderLastShown";
import { todayStr } from "@/lib/dateUtil";

const SHOWER_ITEM_TITLE = "기상 후 샤워";
const THROTTLE_MS = 2 * 60 * 60 * 1000; // 2시간
/** 첫 체크 지연(0=즉시). 헬스장 +20분, 유튜브 +40분과 20분 간격 유지 */
const INITIAL_DELAY_MS = 0;
/** 테스트용: true면 새로고침할 때마다 무조건 팝업 표시 (완료 여부·2시간 제한 무시). 테스트 후 false로 되돌리기 */
const TEST_ALWAYS_SHOW = false;

const BENEFITS: { text: string; bold: string[] }[] = [
  { text: "뇌가 깨어나 인지기능 상승!", bold: ["인지기능"] },
  { text: "창의적 사고 촉진", bold: ["창의적 사고"] },
  { text: "문제 해결능력 UP", bold: ["문제 해결능력"] },
  { text: "자는동안 쌓인 피지, 땀, 먼지 제거", bold: ["피지, 땀, 먼지"] },
  { text: "혈액순환 촉진으로 붓기 완화", bold: ["혈액순환", "붓기"] },
  { text: "하루 시작을 알리는 신호!", bold: ["하루 시작"] },
];

function benefitLineWithBold(text: string, boldWords: string[]) {
  if (boldWords.length === 0) return text;
  const sorted = [...boldWords].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    boldWords.includes(part) ? (
      <strong key={i} className="font-bold">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

interface ShowerReminderPopupProps {
  /** 홈에서 ?testAlerts=1 시 알림 테스트용으로 강제 표시 */
  forceShow?: boolean;
}

export function ShowerReminderPopup({ forceShow }: ShowerReminderPopupProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "benefits" | "goodbye">("ask");
  const [itemId, setItemId] = useState<number | null>(null);
  const [showIcon, setShowIcon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const checkAndShow = useCallback(async () => {
    const today = todayStr();
    const [items, completions] = await Promise.all([loadRoutineItems(), loadRoutineCompletions()]);
    const showerItem = items.find((i) => i.title.trim() === SHOWER_ITEM_TITLE);
    if (forceShow) {
      setItemId(showerItem?.id ?? null);
      setStep("ask");
      setOpen(true);
      return;
    }
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) return;
    if (!showerItem) return;
    if (!TEST_ALWAYS_SHOW) {
      const completedToday = (completions[today] ?? []).includes(showerItem.id);
      if (completedToday) return;
      const last = await getReminderLastShown("shower");
      const now = Date.now();
      if (last && last.date === today && now - last.time < THROTTLE_MS) return;
    }

    setItemId(showerItem.id);
    setStep("ask");
    setOpen(true);
    await setReminderLastShown("shower");
  }, [forceShow]);

  useEffect(() => {
    if (forceShow) {
      checkAndShow();
      return;
    }
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      checkAndShow();
      intervalId = setInterval(checkAndShow, THROTTLE_MS);
    }, INITIAL_DELAY_MS);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [forceShow, checkAndShow]);

  const handleYes = useCallback(async () => {
    if (itemId === null) return;
    await toggleRoutineCompletion(todayStr(), itemId, true);
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      setOpen(false);
    }, 650);
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

  if (!open && !showIcon && !showConfetti) return null;

  const CONFETTI_COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#e879f9"];
  const particleCount = 40;
  const confettiParticles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * 360 + (i % 5) * 7;
    const rad = (angle * Math.PI) / 180;
    const dist = 280 + (i % 5) * 60 + (i % 3) * 30;
    return { x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], size: 12 + (i % 4) * 4 };
  });

  if (showIcon && typeof document !== "undefined" && document.body) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
        aria-hidden
      >
        <div className="shower-goodbye-icon text-[240px]">
          <span className="inline-block" role="img" aria-label="좋아요">
            👍
          </span>
        </div>
      </div>,
      document.body
    );
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shower-reminder-title"
    >
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          {confettiParticles.map((p, i) => (
            <div
              key={i}
              className="confetti-dot absolute rounded-full"
              style={{
                left: "50%",
                top: "50%",
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                backgroundColor: p.color,
                ["--tx" as string]: `${p.x}px`,
                ["--ty" as string]: `${p.y}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      <div className={`relative w-full max-w-sm rounded-2xl bg-white px-6 py-10 shadow-xl transition-opacity duration-300 ${showConfetti ? "opacity-0" : "opacity-100"}`}>
        {step === "ask" && (
          <>
            <div className="flex justify-center mb-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl" role="img" aria-label="알림">
                🔔
              </span>
            </div>
            <h2 id="shower-reminder-title" className="text-center text-lg font-semibold text-neutral-900">
              기상 후 샤워 하셨나요?
            </h2>
            <div className="mt-10 flex flex-nowrap items-center justify-center gap-4 sm:gap-8">
              <button
                type="button"
                onClick={handleYes}
                className="flex min-h-[72px] min-w-[80px] shrink-0 items-center justify-center rounded-3xl bg-neutral-800 px-8 py-6 text-4xl font-bold text-white hover:bg-red-500 hover:border-red-500 sm:min-w-[100px] sm:px-14"
              >
                O
              </button>
              <button
                type="button"
                onClick={handleNo}
                className="flex min-h-[72px] min-w-[80px] shrink-0 items-center justify-center rounded-3xl border-2 border-neutral-300 px-8 py-6 text-4xl font-bold text-neutral-700 hover:bg-neutral-100 sm:min-w-[100px] sm:px-14"
              >
                X
              </button>
            </div>
          </>
        )}
        {step === "benefits" && (
          <>
            <p className="benefits-subtitle mb-6 text-center text-lg font-semibold text-neutral-700">
              지금 샤워를 하면,
            </p>
            <ul className="space-y-2.5 text-lg leading-relaxed text-neutral-800 md:text-xl">
              {BENEFITS.map((item, i) => (
                <li
                  key={item.text}
                  className="benefit-item flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-amber-100 hover:shadow-md hover:border-amber-200/90"
                  style={{ animationDelay: `${i * 0.38}s` }}
                >
                  <span className="shrink-0 text-xl font-bold text-amber-500 md:text-2xl" aria-hidden>
                    ✓
                  </span>
                  <span className="font-medium">{benefitLineWithBold(item.text, item.bold)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleGood}
              className="group mt-8 w-full rounded-xl bg-neutral-800 py-4 text-lg font-semibold text-white shadow-none transition-all hover:bg-gradient-to-r hover:from-neutral-700 hover:to-neutral-800 hover:shadow-lg hover:shadow-neutral-800/35"
            >
              <span className="inline group-hover:hidden">좋아!</span>
              <span className="hidden group-hover:inline">JUST DO!</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (!open && !showConfetti) return null;
  return typeof document !== "undefined" && document.body ? createPortal(modal, document.body) : null;
}
