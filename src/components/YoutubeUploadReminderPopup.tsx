"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { getReminderLastShown, setReminderLastShown } from "@/lib/reminderLastShown";
import { todayStr } from "@/lib/dateUtil";

const YOUTUBE_ITEM_TITLE = "유튜브 업로드";
const THROTTLE_MS = 30 * 60 * 1000; // 30분마다 알림
/** 테스트용: true면 새로고침할 때마다 무조건 팝업 표시. 테스트 후 false로 되돌리기 */
const TEST_ALWAYS_SHOW = false;

const BENEFITS: { text: string; bold: string[] }[] = [
  { text: "삽질하는게 겁난다? 그냥 해야한다!", bold: ["그냥 해야한다!"] },
  { text: "쇼츠는 물량을 퍼부어야 한다.", bold: ["물량"] },
  { text: "사실 소재가 전부다!", bold: ["소재"] },
  { text: "텍홀님은 매일 8개 올렸다", bold: ["매일 8개"] },
  { text: "월억남님은 술 먹고 와서도 했다.", bold: ["술 먹고"] },
  { text: "디하클에 월억이 5명 넘는다.", bold: ["월억"] },
  { text: "홈피 할래? 유튜브 할래?", bold: ["유튜브"] },
];

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
      setOpen(true);
      return;
    }
    if (!youtubeItem) return;
    if (!TEST_ALWAYS_SHOW) {
      const completedToday = (completions[today] ?? []).includes(youtubeItem.id);
      if (completedToday) return;
      const last = await getReminderLastShown("youtube");
      const now = Date.now();
      if (last && last.date === today && now - last.time < THROTTLE_MS) return;
    }

    setItemId(youtubeItem.id);
    setStep("ask");
    setOpen(true);
    await setReminderLastShown("youtube");
  }, [forceShow]);

  useEffect(() => {
    if (forceShow) {
      checkAndShow();
      return;
    }
    checkAndShow();
    const intervalId = setInterval(checkAndShow, THROTTLE_MS);
    return () => clearInterval(intervalId);
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
        className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/30"
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
      className="fixed inset-0 z-[9997] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.78)" }}
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
      <div className={`relative w-full max-w-sm rounded-2xl bg-white px-6 py-10 shadow-xl transition-opacity duration-300 ${showConfetti ? "opacity-0" : "opacity-100"}`}>
        {step === "ask" && (
          <>
            <div className="flex justify-center mb-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 p-2" role="img" aria-label="유튜브">
                <svg viewBox="0 0 24 24" className="h-full w-full text-white" fill="currentColor" aria-hidden>
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </span>
            </div>
            <h2 id="youtube-upload-reminder-title" className="text-center text-lg font-semibold text-neutral-900">
              오늘 유튜브 업로드 하셨나요?
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
              지금 유튜브 업로드 하면,
            </p>
            <ul className="space-y-2.5 text-lg leading-relaxed text-neutral-800 md:text-xl">
              {BENEFITS.map((item, i) => (
                <li
                  key={item.text}
                  className="benefit-item flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-amber-100 hover:shadow-md hover:border-amber-200/90 border border-transparent"
                  style={{ animationDelay: `${i * 0.38}s` }}
                >
                  <span className="shrink-0 text-xl font-bold text-amber-500 md:text-2xl" aria-hidden>
                    ✓
                  </span>
                  <span className="font-medium">{benefitLineWithBold(item.text, item.bold)}</span>
                </li>
              ))}
              <li
                className="benefit-item"
                style={{ animationDelay: `${BENEFITS.length * 0.38}s` }}
              >
                <a
                  href={ANTI_VISION_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-neutral-200/80 bg-neutral-100/80 px-3 py-2 transition-colors hover:bg-red-50 hover:border-red-200 hover:shadow-md hover:shadow-red-100"
                >
                  <span className="shrink-0 text-xl font-bold text-neutral-500 md:text-2xl" aria-hidden>
                    ✓
                  </span>
                  <span className="font-medium text-neutral-700">그래도 안해? ANTI-VISION →</span>
                </a>
              </li>
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
