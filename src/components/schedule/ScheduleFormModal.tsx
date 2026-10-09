"use client";

import { useState } from "react";
import { todayStr } from "@/lib/dateUtil";
import type { ScheduleEntry, ScheduleType } from "@/lib/scheduleDb";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export type FormPayload = {
  title: string;
  scheduleType: ScheduleType;
  onceDate: string | null;
  monthlyDay: number | null;
  yearlyMonth: number | null;
  yearlyDay: number | null;
  weeklyDay: number | null;
  time: string | null;
  important: boolean;
};

export function ScheduleFormModal({
  onClose,
  onSubmit,
  onDelete,
  modalTitle,
  initial,
  initialDate,
}: {
  onClose: () => void;
  onSubmit: (p: FormPayload) => Promise<void>;
  onDelete?: () => void | Promise<void>;
  modalTitle: string;
  initial?: ScheduleEntry;
  /** 새로 추가할 때 미리 채울 날짜 (YYYY-MM-DD). 달력에서 날짜를 눌러 열 때 */
  initialDate?: string;
}) {
  const startDate = initialDate ? new Date(initialDate + "T12:00:00") : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    initial?.scheduleType ?? "once"
  );
  const [onceDate, setOnceDate] = useState(
    initial?.onceDate ?? initialDate ?? todayStr()
  );
  const [monthlyDay, setMonthlyDay] = useState(initial?.monthlyDay ?? startDate?.getDate() ?? 15);
  const [yearlyMonth, setYearlyMonth] = useState(initial?.yearlyMonth ?? (startDate ? startDate.getMonth() + 1 : 1));
  const [yearlyDay, setYearlyDay] = useState(initial?.yearlyDay ?? startDate?.getDate() ?? 1);
  const [weeklyDay, setWeeklyDay] = useState(initial?.weeklyDay ?? startDate?.getDay() ?? 1);
  const [time, setTime] = useState(initial?.time ?? "");
  const [important, setImportant] = useState(initial?.important ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        scheduleType,
        onceDate: scheduleType === "once" ? onceDate : null,
        monthlyDay: scheduleType === "monthly" ? monthlyDay : null,
        yearlyMonth: scheduleType === "yearly" ? yearlyMonth : null,
        yearlyDay: scheduleType === "yearly" ? yearlyDay : null,
        weeklyDay: scheduleType === "weekly" ? weeklyDay : null,
        time: time.trim() || null,
        important,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/75 p-4"
      style={{ left: 0, top: 0, right: 0, bottom: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
    >
      <div
        className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900">{modalTitle}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-600">
              제목
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setImportant((v) => !v)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-2xl transition ${
                  important
                    ? "border-amber-300 bg-amber-50 text-amber-500"
                    : "border-neutral-200 text-neutral-300 hover:text-amber-400"
                }`}
                title={important ? "중요 일정 해제" : "중요 일정으로 표시"}
                aria-label={important ? "중요 일정 해제" : "중요 일정으로 표시"}
                aria-pressed={important}
              >
                ★
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600">
              반복
            </label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
            >
              <option value="once">한 번만</option>
              <option value="monthly">매월 N일</option>
              <option value="yearly">매년 M월 D일</option>
              <option value="weekly">매주 요일</option>
            </select>
          </div>
          {scheduleType === "once" && (
            <div>
              <label className="block text-sm font-medium text-neutral-600">
                날짜
              </label>
              <input
                type="date"
                value={onceDate}
                onChange={(e) => setOnceDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>
          )}
          {scheduleType === "monthly" && (
            <div>
              <label className="block text-sm font-medium text-neutral-600">
                매월 몇 일
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>
          )}
          {scheduleType === "yearly" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-600">
                  월
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={yearlyMonth}
                  onChange={(e) =>
                    setYearlyMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600">
                  일
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={yearlyDay}
                  onChange={(e) =>
                    setYearlyDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                />
              </div>
            </div>
          )}
          {scheduleType === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-neutral-600">
                요일
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWeeklyDay(i)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      weeklyDay === i
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-600">
              시간 <span className="text-neutral-400">(선택)</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {initial && onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    await onDelete();
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
