"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { getReminderLastShown, setReminderLastShown } from "@/lib/reminderLastShown";
import { dispatchReminderOpen, subscribeReminderOpen, REMINDER_POPUP_Z_INDEX, REMINDER_BACKDROP_OPACITY } from "@/lib/reminderPopupChannel";
import { getPopupConfig } from "@/lib/popupReminderConfig";
import { todayStr } from "@/lib/dateUtil";

const GYM_ITEM_TITLE = "헬스장";
const THROTTLE_MS = 1 * 60 * 60 * 1000; // 1시간 (오후 6시 이후 1시간 단위)
/** 첫 체크 지연(20분). 샤워 0분, 유튜브 40분과 20분 간격 유지 */
const INITIAL_DELAY_MS = 20 * 60 * 1000;
/** 테스트용: true면 새로고침할 때마다 무조건 팝업 표시. 테스트 후 false로 되돌리기 */
const TEST_ALWAYS_SHOW = false;

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

interface GymReminderPopupProps {
  forceShow?: boolean;
}

export function GymReminderPopup({ forceShow }: GymReminderPopupProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "benefits" | "goodbye">("ask");
  const [itemId, setItemId] = useState<number | null>(null);
  const [showIcon, setShowIcon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const checkAndShow = useCallback(async () => {
    const today = todayStr();
    const [items, completions] = await Promise.all([loadRoutineItems(), loadRoutineCompletions()]);
    const gymItem = items.find((i) => i.title.trim() === GYM_ITEM_TITLE);
    if (forceShow) {
      setItemId(gymItem?.id ?? null);
      setStep("ask");
      dispatchReminderOpen("gym");
      setOpen(true);
      return;
    }
    if (getPopupConfig("gym")?.enabled === false) return;
    const hour = new Date().getHours();
    if (hour < 18) return; // 오후 6시(18:00) 이후에만 헬스장 알림
    if (!gymItem) return;
    if (!TEST_ALWAYS_SHOW) {
      const completedToday = (completions[today] ?? []).includes(gymItem.id);
      if (completedToday) return;
      const last = await getReminderLastShown("gym");
      const now = Date.now();
      if (last && last.date === today && now - last.time < THROTTLE_MS) return;
    }

    setItemId(gymItem.id);
    setStep("ask");
    dispatchReminderOpen("gym");
    setOpen(true);
    await setReminderLastShown("gym");
  }, [forceShow]);

  useEffect(() => {
    return subscribeReminderOpen("gym", () => setOpen(false));
  }, []);

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

  const config = getPopupConfig("gym");
  const title = config?.title ?? "오늘 헬스장 가셨나요?";
  const benefitsSubtitle = config?.benefitsSubtitle ?? "헬스장에 가면,";
  const benefits = config?.benefits ?? [];
  const cardStyle: React.CSSProperties = {};
  if (config?.cardBgColor) cardStyle.backgroundColor = config.cardBgColor;
  if (config?.textColor) cardStyle.color = config.textColor;
  const accentStyle = config?.accentColor ? { color: config.accentColor } : undefined;

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
        className="fixed inset-0 flex items-center justify-center bg-black/65"
        style={{ zIndex: REMINDER_POPUP_Z_INDEX }}
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
      className="fixed inset-0 flex min-h-[100dvh] min-w-[100vw] items-center justify-center p-4"
      style={{ zIndex: REMINDER_POPUP_Z_INDEX, backgroundColor: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gym-reminder-title"
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
      <div className={`relative w-full max-w-sm rounded-2xl px-6 py-10 shadow-xl transition-opacity duration-300 ${showConfetti ? "opacity-0" : "opacity-100"}`} style={{ ...cardStyle, backgroundColor: cardStyle.backgroundColor ?? "#fff" }}>
        {step === "ask" && (
          <>
            <div className="flex justify-center mb-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl" role="img" aria-label="알림">
                💪
              </span>
            </div>
            <h2 id="gym-reminder-title" className="text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
              {title}
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
            {benefitsSubtitle && (
              <p className="benefits-subtitle mb-6 text-center text-lg font-semibold text-neutral-700" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
                {benefitsSubtitle}
              </p>
            )}
            <ul className="space-y-2.5 text-lg leading-relaxed md:text-xl" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
              {benefits.map((item, i) => (
                <li
                  key={i}
                  className="benefit-item flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-amber-100 hover:shadow-md hover:border-amber-200/90"
                  style={{ animationDelay: `${i * 0.38}s` }}
                >
                  <span className="shrink-0 text-xl font-bold md:text-2xl" style={accentStyle ?? { color: "#f59e0b" }} aria-hidden>
                    ✓
                  </span>
                  <span className="font-medium">{benefitLineWithBold(item.text, item.bold ?? [])}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleGood}
              className="group mt-8 w-full rounded-xl py-4 text-lg font-semibold text-white shadow-none transition-all hover:bg-gradient-to-r hover:from-neutral-700 hover:to-neutral-800 hover:shadow-lg hover:shadow-neutral-800/35"
              style={config?.accentColor ? { backgroundColor: config.accentColor } : { backgroundColor: "#262626" }}
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
