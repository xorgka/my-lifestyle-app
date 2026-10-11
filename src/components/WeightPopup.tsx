"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadDietDay, loadWeightLog, saveDietDay, todayDateKey } from "@/lib/dietDb";
import { dispatchReminderOpen, subscribeReminderOpen, REMINDER_POPUP_Z_INDEX, REMINDER_BACKDROP_OPACITY } from "@/lib/reminderPopupChannel";
import { getPopupConfig, isInTimeWindow } from "@/lib/popupReminderConfig";

/** 다른 알림 팝업(기상 시간 등)이 떠 있으면 닫힐 때까지 기다렸다가 띄운다 */
function otherPopupOpen(): boolean {
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

/**
 * 아침 몸무게 팝업: 오늘 몸무게도 먹은 기록도 없으면 뜬다.
 * 몸무게를 적거나 첫 식사를 기록하면 그날은 더 안 뜬다 (밥 먹은 뒤엔 아침 몸무게가 아니니까).
 */
export function WeightPopup() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const shouldShow = useCallback(async () => {
    const config = getPopupConfig("weight");
    if (config?.enabled === false) return false;
    if (!isInTimeWindow(config?.timeStart ?? 5, config?.timeEnd ?? 14)) return false;
    const { day } = await loadDietDay(todayDateKey());
    return day.weightKg == null && day.meals.length === 0;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const tryOpen = async () => {
      if (cancelled) return;
      if (otherPopupOpen()) {
        timer = window.setTimeout(tryOpen, 3000);
        return;
      }
      if (!(await shouldShow()) || cancelled) return;
      // 입력칸에 마지막 몸무게를 미리 채워 둔다
      const log = await loadWeightLog().catch(() => []);
      const last = log[log.length - 1]?.weightKg;
      if (cancelled) return;
      if (last != null) setValue(String(last));
      dispatchReminderOpen("weight");
      setOpen(true);
    };
    // 기상 시간 팝업 등이 먼저 뜨도록 조금 늦게 확인
    timer = window.setTimeout(tryOpen, 1500);
    // 다른 알림이 뜨면 비켜 줬다가, 그게 닫히면 다시 띄운다 ("나중에"로 닫은 건 다시 안 띄움)
    const unsubscribe = subscribeReminderOpen("weight", () => {
      setOpen((wasOpen) => {
        if (wasOpen) {
          window.clearTimeout(timer);
          timer = window.setTimeout(tryOpen, 3000);
        }
        return false;
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [shouldShow]);

  const kg = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(kg) && kg >= 20 && kg <= 300;

  const handleSubmit = useCallback(async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { day } = await loadDietDay(todayDateKey());
      await saveDietDay({ ...day, weightKg: Math.round(kg * 10) / 10 });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }, [valid, saving, kg]);

  if (!open) return null;

  const config = getPopupConfig("weight");
  const title = config?.title ?? "오늘 아침 몸무게는?";
  const cardStyle: React.CSSProperties = {};
  if (config?.cardBgColor) cardStyle.backgroundColor = config.cardBgColor;
  if (config?.textColor) cardStyle.color = config.textColor;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
      style={{ zIndex: REMINDER_POPUP_Z_INDEX, backgroundColor: `rgba(0,0,0,${REMINDER_BACKDROP_OPACITY})` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-popup-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl px-6 py-10 shadow-xl" style={{ ...cardStyle, backgroundColor: cardStyle.backgroundColor ?? "#fff" }}>
        <div className="mb-4 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-3xl" role="img" aria-label="몸무게">
            ⚖️
          </span>
        </div>
        <h2 id="weight-popup-title" className="text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
          {title}
        </h2>
        <p className="mt-1 text-center text-sm text-neutral-500">밥 먹기 전에 재서 적어 주세요</p>
        <form
          className="mt-6 flex flex-col items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex w-full items-center rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-400">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={20}
              max={300}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full bg-transparent text-center text-2xl font-semibold tabular-nums text-neutral-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="몸무게 (kg)"
            />
            <span className="shrink-0 text-lg font-medium text-neutral-400">kg</span>
          </div>
          <button
            type="submit"
            disabled={!valid || saving}
            className="w-full rounded-xl py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={config?.accentColor ? { backgroundColor: config.accentColor } : { backgroundColor: "#262626" }}
          >
            입력
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-400 hover:text-neutral-600">
            나중에
          </button>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" && document.body ? createPortal(modal, document.body) : null;
}
