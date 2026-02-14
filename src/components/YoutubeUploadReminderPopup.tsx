"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { getReminderLastShown, setReminderLastShown } from "@/lib/reminderLastShown";
import { dispatchReminderOpen, subscribeReminderOpen, REMINDER_POPUP_Z_INDEX, REMINDER_BACKDROP_OPACITY } from "@/lib/reminderPopupChannel";
import { getPopupConfig, isInTimeWindow } from "@/lib/popupReminderConfig";
import { todayStr } from "@/lib/dateUtil";

const YOUTUBE_ITEM_TITLE = "유튜브 업로드";
const TEST_ALWAYS_SHOW = false;

const ANTI_VISION_LINK = "https://wagle.imweb.me/87?preview_mode=1";

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

interface YoutubeUploadReminderPopupProps {
  forceShow?: boolean;
}

export function YoutubeUploadReminderPopup({ forceShow }: YoutubeUploadReminderPopupProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "benefits" | "goodbye">("ask");
  const [itemId, setItemId] = useState<number | null>(null);
  const [showIcon, setShowIcon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const checkAndShow = useCallback(async () => {
    const today = todayStr();
    const [items, completions] = await Promise.all([loadRoutineItems(), loadRoutineCompletions()]);
    const youtubeItem = items.find((i) => i.title.trim() === YOUTUBE_ITEM_TITLE);
    if (forceShow) {
      setItemId(youtubeItem?.id ?? null);
      setStep("ask");
      dispatchReminderOpen("youtube");
      setOpen(true);
      return;
    }
    const config = getPopupConfig("youtube");
    if (config?.enabled === false) return;
    const timeStart = config?.timeStart ?? 0;
    const timeEnd = config?.timeEnd ?? 23;
    if (!isInTimeWindow(timeStart, timeEnd)) return;
    if (!youtubeItem) return;
    if (!TEST_ALWAYS_SHOW) {
      const completedToday = (completions[today] ?? []).includes(youtubeItem.id);
      if (completedToday) return;
      const last = await getReminderLastShown("youtube");
      const now = Date.now();
      const throttleMs = (config?.throttleMinutes ?? 30) * 60 * 1000;
      if (last && last.date === today && now - last.time < throttleMs) return;
    }

    setItemId(youtubeItem.id);
    setStep("ask");
    dispatchReminderOpen("youtube");
    setOpen(true);
    await setReminderLastShown("youtube");
  }, [forceShow]);

  useEffect(() => {
    return subscribeReminderOpen("youtube", () => setOpen(false));
  }, []);

  useEffect(() => {
    if (forceShow) {
      checkAndShow();
      return;
    }
    const config = getPopupConfig("youtube");
    const throttleMs = (config?.throttleMinutes ?? 30) * 60 * 1000;
    checkAndShow();
    const intervalId = throttleMs > 0 ? setInterval(checkAndShow, throttleMs) : null;
    return () => (intervalId ? clearInterval(intervalId) : undefined);
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

  const config = getPopupConfig("youtube");
  const title = config?.title ?? "오늘 유튜브 업로드 하셨나요?";
  const benefitsSubtitle = config?.benefitsSubtitle ?? "미루지말고 하나라도 더 올리세요!";
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
      aria-labelledby="youtube-upload-reminder-title"
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
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 p-2" role="img" aria-label="유튜브">
                <svg viewBox="0 0 24 24" className="h-full w-full text-white" fill="currentColor" aria-hidden>
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </span>
            </div>
            <h2 id="youtube-upload-reminder-title" className="text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
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
                  className="benefit-item flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-amber-100 hover:shadow-md hover:border-amber-200/90 border border-transparent"
                  style={{ animationDelay: `${i * 0.38}s` }}
                >
                  <span className="shrink-0 text-xl font-bold md:text-2xl" style={accentStyle ?? { color: "#f59e0b" }} aria-hidden>
                    ✓
                  </span>
                  <span className="font-medium">{benefitLineWithBold(item.text, item.bold ?? [])}</span>
                </li>
              ))}
              <li
                className="benefit-item-fade"
                style={{ animationDelay: `${benefits.length * 0.38}s` }}
              >
                <a
                  href={ANTI_VISION_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-700 shadow-md shadow-red-200/50 transition-all hover:border-red-500 hover:bg-red-100 hover:shadow-lg hover:shadow-red-300/40"
                >
                  <span className="shrink-0 text-2xl font-bold text-red-500 md:text-3xl" aria-hidden>
                    ✓
                  </span>
                  <span className="text-lg md:text-xl">그래도 안해? ANTI-VISION →</span>
                </a>
              </li>
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
