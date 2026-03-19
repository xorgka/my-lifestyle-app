"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadSleepData, saveSleepRecord } from "@/lib/sleepDb";
import { dispatchReminderOpen, subscribeReminderOpen, REMINDER_POPUP_Z_INDEX, REMINDER_BACKDROP_OPACITY } from "@/lib/reminderPopupChannel";
import { getPopupConfig, isInTimeWindow } from "@/lib/popupReminderConfig";
import { todayStr } from "@/lib/dateUtil";
import { TimeInputWithAmPm } from "@/components/ui/TimeInputWithAmPm";

interface WakeTimePopupProps {
  /** 홈 '알림 테스트' 클릭 시 기상 시간 팝업만 강제 표시 */
  forceShow?: boolean;
}

export function WakeTimePopup({ forceShow }: WakeTimePopupProps) {
  const [open, setOpen] = useState(false);
  const [timeValue, setTimeValue] = useState("07:00");

  const checkAndShow = useCallback(async () => {
    if (forceShow) {
      dispatchReminderOpen("wake");
      setOpen(true);
      return;
    }
    const config = getPopupConfig("wake");
    if (config?.enabled === false) return;
    const timeStart = config?.timeStart ?? 7;
    const timeEnd = config?.timeEnd ?? 13;
    if (!isInTimeWindow(timeStart, timeEnd)) return;
    const today = todayStr();
    const { data } = await loadSleepData();
    if (data[today]?.wakeTime) return;
    dispatchReminderOpen("wake");
    setOpen(true);
  }, [forceShow]);

  useEffect(() => {
    return subscribeReminderOpen("wake", () => setOpen(false));
  }, []);

  useEffect(() => {
    checkAndShow();
  }, [checkAndShow]);

  const handleSubmit = useCallback(async () => {
    const today = todayStr();
    await saveSleepRecord(today, { wakeTime: timeValue });
    setOpen(false);
  }, [timeValue]);

  if (!open) return null;

  const config = getPopupConfig("wake");
  const title = config?.title ?? "오늘 몇 시에 깼나요?";
  const cardStyle: React.CSSProperties = {};
  if (config?.cardBgColor) cardStyle.backgroundColor = config.cardBgColor;
  if (config?.textColor) cardStyle.color = config.textColor;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
      style={{ zIndex: REMINDER_POPUP_Z_INDEX, backgroundColor: `rgba(0,0,0,${REMINDER_BACKDROP_OPACITY})` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wake-time-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl px-6 py-10 shadow-xl" style={{ ...cardStyle, backgroundColor: cardStyle.backgroundColor ?? "#fff" }}>
        <div className="flex justify-center mb-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1e3a5f] via-[#152a47] to-[#0f172a] text-3xl"
            role="img"
            aria-label="수면"
          >
            🌙
          </span>
        </div>
        <h2 id="wake-time-title" className="text-center text-lg font-semibold" style={cardStyle.color ? { color: cardStyle.color } : undefined}>
          {title}
        </h2>
        <div className="mt-6 flex flex-col items-center gap-4">
          <TimeInputWithAmPm
            value={timeValue}
            onChange={setTimeValue}
            onSubmit={handleSubmit}
            className="w-full justify-center"
            inputClassName="px-4 py-3"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-xl py-4 text-lg font-semibold text-white transition hover:opacity-90"
            style={config?.accentColor ? { backgroundColor: config.accentColor } : { backgroundColor: "#262626" }}
          >
            입력
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" && document.body
    ? createPortal(modal, document.body)
    : null;
}
