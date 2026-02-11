"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import {
  loadCustomPopupIds,
  getPopupConfig,
  type PopupConfig,
  type PopupBenefitItem,
} from "@/lib/popupReminderConfig";
import { getReminderLastShownAny, setReminderLastShownAny } from "@/lib/reminderLastShown";
import { dispatchReminderOpenAny, subscribeReminderOpen, REMINDER_POPUP_Z_INDEX, REMINDER_BACKDROP_OPACITY } from "@/lib/reminderPopupChannel";
import { todayStr } from "@/lib/dateUtil";

const CUSTOM_THROTTLE_MS = 2 * 60 * 60 * 1000; // 2시간

function isInTimeWindow(start: number, end: number): boolean {
  const h = new Date().getHours();
  if (start <= end) return h >= start && h <= end;
  return h >= start || h <= end; // e.g. 22~3
}

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

export function CustomReminderPopups() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "benefits">("ask");
  const [popupId, setPopupId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<number | null>(null);
  const [config, setConfig] = useState<PopupConfig | null>(null);

  const checkAndShow = useCallback(async () => {
    const ids = loadCustomPopupIds();
    if (ids.length === 0) return;
    const today = todayStr();
    const [items, completions] = await Promise.all([loadRoutineItems(), loadRoutineCompletions()]);
    const completedToday = new Set(completions[today] ?? []);

    for (const id of ids) {
      const c = getPopupConfig(id);
      if (!c?.enabled || !c.routineTitle?.trim()) continue;
      const timeStart = c.timeStart ?? 22;
      const timeEnd = c.timeEnd ?? 3;
      if (!isInTimeWindow(timeStart, timeEnd)) continue;
      const match = items.find((i) => i.title.trim().includes(c.routineTitle!.trim()));
      if (!match || completedToday.has(match.id)) continue;
      const last = await getReminderLastShownAny(id);
      const now = Date.now();
      if (last?.date === today && now - last.time < CUSTOM_THROTTLE_MS) continue;

      setPopupId(id);
      setConfig(c);
      setItemId(match.id);
      setStep("ask");
      dispatchReminderOpenAny(id);
      setOpen(true);
      await setReminderLastShownAny(id);
      return;
    }
  }, []);

  useEffect(() => {
    if (!popupId) return;
    return subscribeReminderOpen(popupId, () => setOpen(false));
  }, [popupId]);

  useEffect(() => {
    checkAndShow();
    const t = setInterval(checkAndShow, CUSTOM_THROTTLE_MS);
    return () => clearInterval(t);
  }, [checkAndShow]);

  const handleYes = useCallback(async () => {
    if (itemId === null) return;
    await toggleRoutineCompletion(todayStr(), itemId, true);
    setOpen(false);
    setPopupId(null);
    setConfig(null);
    setItemId(null);
  }, [itemId]);

  const handleNo = useCallback(() => {
    setStep("benefits");
  }, []);

  const handleGood = useCallback(() => {
    setOpen(false);
    setPopupId(null);
    setConfig(null);
    setItemId(null);
  }, []);

  if (!open || !config || !popupId) return null;

  const title = config.title || "했나요?";
  const benefitsSubtitle = config.benefitsSubtitle ?? "";
  const benefits = config.benefits ?? [];
  const cardStyle: React.CSSProperties = {};
  if (config.cardBgColor) cardStyle.backgroundColor = config.cardBgColor;
  if (config.textColor) cardStyle.color = config.textColor;
  const accentStyle = config.accentColor ? { color: config.accentColor } : undefined;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
      style={{ zIndex: REMINDER_POPUP_Z_INDEX }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-reminder-title"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl px-6 py-10 shadow-xl"
        style={{ ...cardStyle, backgroundColor: cardStyle.backgroundColor ?? "#fff" }}
      >
        {step === "ask" && (
          <>
            <div className="flex justify-center mb-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-3xl" role="img" aria-label="알림">
                🔔
              </span>
            </div>
            <h2 id="custom-reminder-title" className="text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
              {title}
            </h2>
            <div className="mt-10 flex flex-nowrap items-center justify-center gap-4 sm:gap-8">
              <button
                type="button"
                onClick={handleYes}
                className="flex min-h-[72px] min-w-[80px] shrink-0 items-center justify-center rounded-3xl px-8 py-6 text-4xl font-bold text-white sm:min-w-[100px] sm:px-14"
                style={config.accentColor ? { backgroundColor: config.accentColor } : { backgroundColor: "#262626" }}
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
              <p className="benefits-subtitle mb-6 text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
                {benefitsSubtitle}
              </p>
            )}
            <ul className="space-y-2.5 text-lg leading-relaxed md:text-xl" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
              {benefits.map((item: PopupBenefitItem, i: number) => (
                <li key={i} className="benefit-item flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-100">
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
              className="mt-8 w-full rounded-xl py-4 text-lg font-semibold text-white"
              style={config.accentColor ? { backgroundColor: config.accentColor } : { backgroundColor: "#262626" }}
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
