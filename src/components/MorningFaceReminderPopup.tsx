"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { getReminderLastShown, setReminderLastShown } from "@/lib/reminderLastShown";
import { dispatchReminderOpen, subscribeReminderOpen, REMINDER_POPUP_Z_INDEX, REMINDER_BACKDROP_OPACITY } from "@/lib/reminderPopupChannel";
import { getPopupConfig } from "@/lib/popupReminderConfig";
import { todayStr } from "@/lib/dateUtil";

const MORNING_FACE_ITEM_TITLE = "아침 세안";
const THROTTLE_MS = 30 * 60 * 1000; // 30분
/** 첫 체크 지연(1분). 페이지 들어온 뒤 1분 뒤에 첫 검사, 이후 30분마다 */
const INITIAL_DELAY_MS = 1 * 60 * 1000;
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

interface MorningFaceReminderPopupProps {
  forceShow?: boolean;
}

export function MorningFaceReminderPopup({ forceShow }: MorningFaceReminderPopupProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "benefits" | "goodbye">("ask");
  const [itemId, setItemId] = useState<number | null>(null);
  const [showIcon, setShowIcon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const checkAndShow = useCallback(async () => {
    const today = todayStr();
    const [items, completions] = await Promise.all([loadRoutineItems(), loadRoutineCompletions()]);
    const faceItem = items.find((i) => i.title.trim().includes(MORNING_FACE_ITEM_TITLE));
    if (forceShow) {
      setItemId(faceItem?.id ?? null);
      setStep("ask");
      dispatchReminderOpen("morning_face");
      setOpen(true);
      return;
    }
    if (getPopupConfig("morning_face")?.enabled === false) return;
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) return;
    if (!faceItem) return;
    if (!TEST_ALWAYS_SHOW) {
      const completedToday = (completions[today] ?? []).includes(faceItem.id);
      if (completedToday) return;
      const last = await getReminderLastShown("morning_face");
      const now = Date.now();
      if (last && last.date === today && now - last.time < THROTTLE_MS) return;
    }

    setItemId(faceItem.id);
    setStep("ask");
    dispatchReminderOpen("morning_face");
    setOpen(true);
    await setReminderLastShown("morning_face");
  }, [forceShow]);

  useEffect(() => {
    return subscribeReminderOpen("morning_face", () => setOpen(false));
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

  // 페이지 진입 후 곧바로 한 번 검사 (첫 체크를 기다리지 않고 바로 조건 확인)
  useEffect(() => {
    if (!forceShow) checkAndShow();
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

  const config = getPopupConfig("morning_face");
  const title = config?.title ?? "아침 세안 하셨나요?";
  const benefitsSubtitle = config?.benefitsSubtitle ?? "아침 세안도 안하시게요?";
  const benefits = config?.benefits ?? [];
  const cardStyle: React.CSSProperties = {};
  if (config?.cardBgColor) cardStyle.backgroundColor = config.cardBgColor;
  if (config?.textColor) cardStyle.color = config.textColor;
  const accentStyle = config?.accentColor ? { color: config.accentColor } : undefined;

  const CONFETTI_COLORS = ["#a78bfa", "#67e8f9", "#fde047", "#86efac", "#f9a8d4", "#93c5fd", "#fdba74", "#c4b5fd"];
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
        <div className="text-[240px]">
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
      aria-labelledby="morning-face-reminder-title"
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
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-3xl" role="img" aria-label="세안">
                🧴
              </span>
            </div>
            <h2 id="morning-face-reminder-title" className="text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
              {title}
            </h2>
            <div className="mt-10 flex flex-nowrap items-center justify-center gap-4 sm:gap-8">
              <button
                type="button"
                onClick={handleYes}
                className="flex min-h-[72px] min-w-[80px] shrink-0 items-center justify-center rounded-3xl bg-neutral-800 px-8 py-6 text-4xl font-bold text-white hover:bg-sky-600 hover:border-sky-600 sm:min-w-[100px] sm:px-14"
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
                  className="benefit-item flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-sky-50 hover:shadow-md hover:border-sky-200/90 border border-transparent"
                  style={{ animationDelay: `${i * 0.38}s` }}
                >
                  <span className="shrink-0 text-xl font-bold md:text-2xl" style={accentStyle ?? { color: "#0ea5e9" }} aria-hidden>
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
              <span className="hidden group-hover:inline">할게요!</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (!open && !showConfetti) return null;
  return typeof document !== "undefined" && document.body ? createPortal(modal, document.body) : null;
}
