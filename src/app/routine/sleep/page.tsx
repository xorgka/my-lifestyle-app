"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/Card";
import { TimeInputWithAmPm } from "@/components/ui/TimeInputWithAmPm";
import { loadSleepData, saveSleepRecord, clearSleepRecordField, type SleepData } from "@/lib/sleepDb";
import {
  todayStr,
  getWeekDateStringsFromMonday,
  getCalendarCells,
  addDays,
  startOfWeek,
} from "@/lib/dateUtil";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAY_SHORT_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** "HH:mm" -> 0~1440 (분) */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 취침(전날 밤) ~ 기상 수면 시간(분). 0이면 표시 안 함 */
function getSleepDurationMinutes(bedTime?: string, wakeTime?: string): number | null {
  if (!bedTime || !wakeTime) return null;
  const bed = timeToMinutes(bedTime);
  let wake = timeToMinutes(wakeTime);
  if (wake <= bed) wake += 1440;
  return wake - bed;
}

/** 수면 분 -> "8시간" 또는 "7시간 30분" */
function formatSleepDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 0~1440 분을 0~1 비율로 (0:00=0, 24:00=1) */
function minutesToRatio(min: number): number {
  return Math.max(0, Math.min(1, min / 1440));
}

/** 하루 수면 바 구간: 취침~기상 (자정 넘기면 두 구간). 반환: [ { from: 0~1, to: 0~1 } ] */
function getSleepSegments(bedTime?: string, wakeTime?: string): { from: number; to: number }[] {
  if (!bedTime || !wakeTime) return [];
  const bed = timeToMinutes(bedTime);
  let wake = timeToMinutes(wakeTime);
  if (wake <= bed) wake += 1440;
  const bedR = minutesToRatio(bed);
  const wakeR = minutesToRatio(wake > 1440 ? wake - 1440 : wake);
  if (wake > 1440) {
    return [
      { from: bedR, to: 1 },
      { from: 0, to: wakeR },
    ];
  }
  return [{ from: bedR, to: wakeR }];
}

/** Y축 04:00(위)~03:00(아래) 기준 막대 위치. 0%=04:00, 100%=다음날 03:00 (총 23h) */
const CHART_MIN_MINUTES = 4 * 60; // 04:00
const CHART_MAX_MINUTES = 24 * 60 + 3 * 60; // 03:00 다음날 = 1620
const CHART_SPAN_MINUTES = CHART_MAX_MINUTES - CHART_MIN_MINUTES; // 1380

function getVerticalBarPosition(bedTime?: string, wakeTime?: string): { topPercent: number; heightPercent: number } | null {
  if (!bedTime || !wakeTime) return null;
  const bed = timeToMinutes(bedTime);
  let wake = timeToMinutes(wakeTime);
  if (wake <= bed) wake += 1440;
  const bedNorm = bed < CHART_MIN_MINUTES ? bed + 1440 : bed;
  const wakeNorm = wake > 1440 ? wake - 1440 : wake;
  const wakeNorm2 = wakeNorm < CHART_MIN_MINUTES ? wakeNorm + 1440 : wakeNorm;
  const topPercent = ((wakeNorm2 - CHART_MIN_MINUTES) / CHART_SPAN_MINUTES) * 100;
  const bedPercent = ((bedNorm - CHART_MIN_MINUTES) / CHART_SPAN_MINUTES) * 100;
  const heightPercent = Math.max(2, bedPercent - topPercent);
  return { topPercent, heightPercent };
}

const CHART_TIME_LABELS = ["04:00", "07:00", "10:00", "13:00", "16:00", "19:00", "22:00", "01:00", "03:00"];

export default function SleepPage() {
  const [data, setData] = useState<SleepData>({});
  const todayKey = todayStr();
  const [viewDateKey, setViewDateKey] = useState(() => todayKey);
  const [editWake, setEditWake] = useState<string | null>(null);
  const [editBed, setEditBed] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  /** 클릭한 날짜 수정 모달 (일주일/달력에서 클릭 시) */
  const [editDayModal, setEditDayModal] = useState<string | null>(null);
  const [editDayWake, setEditDayWake] = useState("07:00");
  const [editDayBed, setEditDayBed] = useState("23:00");
  /** 막대 끝 호버 툴팁 (PC) */
  const [barTooltip, setBarTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  /** 왼쪽 통계 박스 호버 툴팁 (한글) */
  const [statTooltip, setStatTooltip] = useState<{ content: React.ReactNode; x: number; y: number } | null>(null);

  const viewRecord = data[viewDateKey];

  const load = useCallback(async () => {
    const next = await loadSleepData();
    setData(next);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveWake = useCallback(async (dateKey: string, value: string) => {
    await saveSleepRecord(dateKey, { wakeTime: value });
    setData((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], wakeTime: value } }));
    setEditWake(null);
  }, []);

  const saveBed = useCallback(async (dateKey: string, value: string) => {
    await saveSleepRecord(dateKey, { bedTime: value });
    setData((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], bedTime: value } }));
    setEditBed(null);
  }, []);

  const openEditDayModal = useCallback(
    (dateKey: string) => {
      const rec = data[dateKey];
      setEditDayWake(rec?.wakeTime ?? "07:00");
      setEditDayBed(rec?.bedTime ?? "23:00");
      setEditDayModal(dateKey);
    },
    [data]
  );

  const saveEditDayModal = useCallback(async () => {
    if (!editDayModal) return;
    await saveSleepRecord(editDayModal, { wakeTime: editDayWake, bedTime: editDayBed });
    setData((prev) => ({
      ...prev,
      [editDayModal]: { ...prev[editDayModal], wakeTime: editDayWake, bedTime: editDayBed },
    }));
    setEditDayModal(null);
  }, [editDayModal, editDayWake, editDayBed]);

  const clearViewWake = useCallback(async () => {
    await clearSleepRecordField(viewDateKey, "wakeTime");
    setData((prev) => ({
      ...prev,
      [viewDateKey]: { ...prev[viewDateKey], wakeTime: undefined },
    }));
    setEditWake(null);
  }, [viewDateKey]);

  const clearViewBed = useCallback(async () => {
    await clearSleepRecordField(viewDateKey, "bedTime");
    setData((prev) => ({
      ...prev,
      [viewDateKey]: { ...prev[viewDateKey], bedTime: undefined },
    }));
    setEditBed(null);
  }, [viewDateKey]);

  const clearEditDayWake = useCallback(async () => {
    if (!editDayModal) return;
    await clearSleepRecordField(editDayModal, "wakeTime");
    setData((prev) => ({
      ...prev,
      [editDayModal]: { ...prev[editDayModal], wakeTime: undefined },
    }));
    setEditDayWake("07:00");
  }, [editDayModal]);

  const clearEditDayBed = useCallback(async () => {
    if (!editDayModal) return;
    await clearSleepRecordField(editDayModal, "bedTime");
    setData((prev) => ({
      ...prev,
      [editDayModal]: { ...prev[editDayModal], bedTime: undefined },
    }));
    setEditDayBed("23:00");
  }, [editDayModal]);

  const viewingWeekMonday = addDays(startOfWeek(new Date()), weekOffset * 7);
  const weekDates = getWeekDateStringsFromMonday(viewingWeekMonday);
  const weekRecords = weekDates.map((dateKey) => ({
    dateKey,
    ...data[dateKey],
  }));

  /** 일주일 평균 수면, 가장 늦게/일찍 기상 */
  const weekStats = (() => {
    const withSleep = weekRecords.filter((r) => getSleepDurationMinutes(r.bedTime, r.wakeTime) != null);
    const totalMins = withSleep.reduce((s, r) => s + (getSleepDurationMinutes(r.bedTime, r.wakeTime) ?? 0), 0);
    const avgSleepMins = withSleep.length ? Math.round(totalMins / withSleep.length) : null;
    const withWake = weekRecords.filter((r) => r.wakeTime);
    const wakeMinutes = (t: string) => timeToMinutes(t);
    const latestWake = withWake.length ? withWake.reduce((a, r) => (wakeMinutes(r.wakeTime!) > wakeMinutes(a.wakeTime!) ? r : a)).wakeTime! : null;
    const earliestWake = withWake.length ? withWake.reduce((a, r) => (wakeMinutes(r.wakeTime!) < wakeMinutes(a.wakeTime!) ? r : a)).wakeTime! : null;
    const goldenTarget = 8 * 60; // 08:00
    const goldenSuccess = weekRecords.filter((r) => r.wakeTime && wakeMinutes(r.wakeTime) <= goldenTarget).length;
    const goldenTimePct = Math.round((goldenSuccess / 7) * 100);
    return { avgSleepMins, latestWake, earliestWake, goldenTimePct };
  })();

  const calendarCells = getCalendarCells(calendarMonth.year, calendarMonth.month);
  const monthDateKeys = calendarCells.filter((c) => c.isCurrentMonth).map((c) => c.dateStr);
  const monthRecords = monthDateKeys.map((dateKey) => ({ dateKey, ...data[dateKey] }));

  /** 달력 선택 월 기준: 평균 수면, 가장 늦게/일찍 기상, 골든타임 % */
  const monthStats = (() => {
    const withSleep = monthRecords.filter((r) => getSleepDurationMinutes(r.bedTime, r.wakeTime) != null);
    const totalMins = withSleep.reduce((s, r) => s + (getSleepDurationMinutes(r.bedTime, r.wakeTime) ?? 0), 0);
    const avgSleepMins = withSleep.length ? Math.round(totalMins / withSleep.length) : null;
    const withWake = monthRecords.filter((r) => r.wakeTime);
    const wakeMinutes = (t: string) => timeToMinutes(t);
    const latestWake = withWake.length ? withWake.reduce((a, r) => (wakeMinutes(r.wakeTime!) > wakeMinutes(a.wakeTime!) ? r : a)).wakeTime! : null;
    const earliestWake = withWake.length ? withWake.reduce((a, r) => (wakeMinutes(r.wakeTime!) < wakeMinutes(a.wakeTime!) ? r : a)).wakeTime! : null;
    const goldenTarget = 8 * 60;
    const goldenSuccess = monthRecords.filter((r) => r.wakeTime && wakeMinutes(r.wakeTime) <= goldenTarget).length;
    const daysInMonth = monthDateKeys.length;
    const goldenTimePct = daysInMonth ? Math.round((goldenSuccess / daysInMonth) * 100) : null;
    return { avgSleepMins, latestWake, earliestWake, goldenTimePct };
  })();

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/routine"
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          루틴으로
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">수면 관리</h1>
        <div className="w-20" />
      </div>

      {/* 오늘 박스: 이전/다음 날짜 선택 + 기상/취침 클릭 수정 */}
      <Card className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              setViewDateKey((k) => addDays(k, -1))
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            aria-label="이전 날"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="min-w-0 flex-1 text-center text-xl font-semibold text-neutral-800">
            {new Date(viewDateKey + "T12:00:00").toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
            {viewDateKey === todayKey && (
              <span className="ml-1 font-normal text-neutral-400">(오늘)</span>
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              setViewDateKey((k) => addDays(k, 1))
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            aria-label="다음 날"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {(() => {
          const sleepMins = getSleepDurationMinutes(viewRecord?.bedTime, viewRecord?.wakeTime);
          const isEditing = editWake !== null || editBed !== null;
          return (
            <div
              className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-slate-50 via-white to-neutral-50 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] sm:py-5"
              onClick={() => isEditing && (setEditWake(null), setEditBed(null))}
            >
              <div className="flex flex-wrap items-stretch justify-center gap-0">
                <div className="flex flex-1 min-w-0 flex-col items-center justify-center px-4 py-3 sm:border-r sm:border-neutral-200/80 sm:px-6">
                  <span className="text-base opacity-80" aria-hidden>☀️</span>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">기상</p>
                  {editWake !== null ? (
                    <div className="mt-2 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <TimeInputWithAmPm
                        value={editWake}
                        onChange={setEditWake}
                        onSubmit={() => saveWake(viewDateKey, editWake)}
                        inputClassName="text-lg"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveWake(viewDateKey, editWake)}
                          className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                        >
                          저장
                        </button>
                        {viewRecord?.wakeTime != null && (
                          <button
                            type="button"
                            onClick={clearViewWake}
                            className="rounded-xl border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editBed !== null) setEditBed(null);
                        else setEditWake(viewRecord?.wakeTime ?? "07:00");
                      }}
                      className="mt-1 text-lg font-bold tabular-nums text-neutral-900 hover:text-neutral-600 sm:text-xl"
                    >
                      {viewRecord?.wakeTime ?? "—"}
                    </button>
                  )}
                </div>
                <div className="w-px shrink-0 bg-neutral-200/80" />
                <div className="flex flex-1 min-w-0 flex-col items-center justify-center px-4 py-3 sm:border-r sm:border-neutral-200/80 sm:px-6">
                  <span className="text-base opacity-80" aria-hidden>🌙</span>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">취침</p>
                  {editBed !== null ? (
                    <div className="mt-2 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <TimeInputWithAmPm
                        value={editBed}
                        onChange={setEditBed}
                        onSubmit={() => saveBed(viewDateKey, editBed)}
                        inputClassName="text-lg"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveBed(viewDateKey, editBed)}
                          className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                        >
                          저장
                        </button>
                        {viewRecord?.bedTime != null && (
                          <button
                            type="button"
                            onClick={clearViewBed}
                            className="rounded-xl border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editWake !== null) setEditWake(null);
                        else setEditBed(viewRecord?.bedTime ?? "23:00");
                      }}
                      className="mt-1 text-lg font-bold tabular-nums text-neutral-900 hover:text-neutral-600 sm:text-xl"
                    >
                      {viewRecord?.bedTime ?? "—"}
                    </button>
                  )}
                </div>
                <div className="w-px shrink-0 bg-neutral-200/80" />
                <div className="flex flex-1 min-w-0 flex-col items-center justify-center px-4 py-3 sm:px-6">
                  <span className="text-base opacity-80" aria-hidden>💤</span>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">수면</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-neutral-800">
                    {sleepMins != null ? formatSleepDuration(sleepMins) : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* 일주일: Y축 시간 차트 (막대 위=기상, 아래=취침) */}
      <Card className="min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">일주일</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
              aria-label="이전 주"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[8rem] text-center text-sm font-medium text-neutral-700">
              {weekOffset === 0 ? "이번 주" : weekOffset < 0 ? `${-weekOffset}주 전` : `${weekOffset}주 후`}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
              aria-label="다음 주"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-800/95 via-neutral-900 to-neutral-800/90 px-3 pt-6 pb-4 sm:px-14 sm:pt-12 sm:pb-10">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 w-full">
            {/* 모바일: 2x2 그리드 / PC: 세로 1열 */}
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-3 shrink-0 w-full sm:w-auto order-1 sm:order-none">
              <div
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 shadow-lg cursor-default"
                onMouseEnter={(e) => setStatTooltip({ content: "일주일 평균 수면시간", x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setStatTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setStatTooltip(null)}
              >
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50 mb-0.5">Avg. Sleep</p>
                <p className="text-sm sm:text-base font-semibold text-white tabular-nums">
                  {weekStats.avgSleepMins != null ? formatSleepDuration(weekStats.avgSleepMins) : "—"}
                </p>
              </div>
              <div
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 shadow-lg cursor-default"
                onMouseEnter={(e) => setStatTooltip({ content: "가장 늦게 일어난 시간", x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setStatTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setStatTooltip(null)}
              >
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50 mb-0.5">Latest Wake</p>
                <p className="text-sm sm:text-base font-semibold text-white tabular-nums">{weekStats.latestWake ?? "—"}</p>
              </div>
              <div
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 shadow-lg cursor-default"
                onMouseEnter={(e) => setStatTooltip({ content: "가장 일찍 일어난 시간", x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setStatTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setStatTooltip(null)}
              >
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50 mb-0.5">Earliest Wake</p>
                <p className="text-sm sm:text-base font-semibold text-white tabular-nums">{weekStats.earliestWake ?? "—"}</p>
              </div>
              <div
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 shadow-lg cursor-default"
                onMouseEnter={(e) => setStatTooltip({ content: <><span className="block">골든타임 준수율</span><span className="block">: 일주일 중 8시 기상 성공율</span></>, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setStatTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setStatTooltip(null)}
              >
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50 mb-0.5">Golden Time %</p>
                <p className="text-sm sm:text-base font-semibold text-white tabular-nums">
                  {weekStats.goldenTimePct != null ? `${weekStats.goldenTimePct}%` : "—"}
                </p>
              </div>
            </div>
            {/* 모바일: 박스 아래 / PC: 오른쪽 차트 */}
          <div className="flex flex-col items-end min-w-0 flex-1 order-2 w-full">
            <div className="w-full max-w-xl sm:max-w-[calc(36rem+4rem)] grid grid-cols-[1fr_auto] gap-0 ml-auto">
              {/* 1열: 막대 차트 + 날짜 (동일 너비로 세로 정렬) */}
              <div className="min-w-0 flex flex-col">
                <div className="relative flex h-[160px] sm:h-[300px] gap-0">
                  {CHART_TIME_LABELS.map((label, i) => (
                    <div
                      key={label}
                      className="pointer-events-none absolute left-0 right-0 h-px"
                      style={{
                        top: `${(i / 8) * 100}%`,
                        background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 3px, transparent 3px, transparent 8px)",
                      }}
                    />
                  ))}
                  {weekRecords.map(({ dateKey, wakeTime, bedTime }) => {
                    const bar = getVerticalBarPosition(bedTime, wakeTime);
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => openEditDayModal(dateKey)}
                        className="relative flex-1 min-w-0 h-full rounded-lg transition hover:bg-neutral-800/50 flex flex-col items-center"
                      >
                        <div className="absolute inset-0 flex flex-col items-center z-10" style={{ paddingTop: "2px", paddingBottom: "2px" }}>
                          {bar ? (
                            <div
                              className="absolute left-1/2 -translate-x-1/2 w-3 sm:w-6 rounded-full bg-gradient-to-b from-blue-300 via-blue-500 to-blue-700"
                              style={{
                                top: `${bar.topPercent}%`,
                                height: `${bar.heightPercent}%`,
                                minHeight: "4px",
                              }}
                            >
                              <span
                                className="absolute -left-4 -right-4 top-0 h-1/3 min-h-[14px] cursor-default"
                                style={{ marginTop: "-7px" }}
                                onMouseEnter={(e) => wakeTime && setBarTooltip({ text: `기상 ${wakeTime}`, x: e.clientX, y: e.clientY })}
                                onMouseMove={(e) => wakeTime && setBarTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                                onMouseLeave={() => setBarTooltip(null)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span
                                className="absolute -left-4 -right-4 bottom-0 h-1/3 min-h-[14px] cursor-default"
                                style={{ marginBottom: "-7px" }}
                                onMouseEnter={(e) => bedTime && setBarTooltip({ text: `취침 ${bedTime}`, x: e.clientX, y: e.clientY })}
                                onMouseMove={(e) => bedTime && setBarTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                                onMouseLeave={() => setBarTooltip(null)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-neutral-500 text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex pt-3 sm:pt-4 pb-2">
                  {weekRecords.map(({ dateKey }, i) => {
                    const isToday = dateKey === todayKey;
                    const dayNum = Number(dateKey.slice(8));
                    return (
                      <div key={dateKey} className="flex-1 min-w-0 flex flex-col items-center justify-center">
                        <span className={`text-[10px] sm:text-xs font-medium text-neutral-400 ${isToday ? "text-white" : ""}`}>
                          <span className="sm:hidden">{WEEKDAY_SHORT_EN[i]}</span>
                          <span className="hidden sm:inline">{dayNum}({WEEKDAY_LABELS[i]})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* 2열: 시간 */}
              <div className="hidden sm:block relative w-12 shrink-0 pl-3 self-start" style={{ height: "300px" }}>
                {CHART_TIME_LABELS.map((label, i) => (
                  <span
                    key={label}
                    className="absolute text-xs font-medium tabular-nums text-white/35 text-right"
                    style={{ top: `${(i / 8) * 100}%`, transform: "translateY(-50%)" }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          </div>
          {/* 막대 호버 툴팁 (body 포탈) */}
          {barTooltip &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="hidden sm:block fixed z-[200] pointer-events-none px-3 py-2 rounded-lg bg-white text-neutral-900 text-sm font-semibold shadow-lg border border-neutral-200 whitespace-nowrap"
                style={{ left: barTooltip.x + 14, top: barTooltip.y + 14 }}
              >
                {barTooltip.text}
              </div>,
              document.body
            )}
          {/* 통계 박스 호버 툴팁 (한글, body 포탈) */}
          {statTooltip &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed z-[200] pointer-events-none px-3 py-2 rounded-lg bg-white text-neutral-900 text-sm font-semibold shadow-lg border border-neutral-200 max-w-[260px]"
                style={{ left: statTooltip.x + 14, top: statTooltip.y + 14 }}
              >
                {statTooltip.content}
              </div>,
              document.body
            )}
        </div>
      </Card>

      {/* 달력: 1줄에 달력(왼쪽) | 좌우버튼+날짜입력(오른쪽) */}
      <Card className="min-w-0 space-y-4">
        <div className="flex flex-nowrap items-center justify-between gap-3">
          <h2 className="shrink-0 text-lg font-semibold text-neutral-900">달력</h2>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(calendarMonth.year, calendarMonth.month - 1, 1);
                d.setMonth(d.getMonth() - 1);
                setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
              aria-label="이전 달"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <select
              value={calendarMonth.year}
              onChange={(e) =>
                setCalendarMonth((p) => ({ ...p, year: Number(e.target.value) }))
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 min-w-0"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={calendarMonth.month}
              onChange={(e) =>
                setCalendarMonth((p) => ({ ...p, month: Number(e.target.value) }))
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 min-w-0"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const d = new Date(calendarMonth.year, calendarMonth.month - 1, 1);
                d.setMonth(d.getMonth() + 1);
                setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
              aria-label="다음 달"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="py-1 font-medium text-neutral-500">
              {d}
            </div>
          ))}
          {calendarCells.map((cell) => {
            const rec = data[cell.dateStr];
            const isCurrent = cell.isCurrentMonth;
            const isToday = cell.dateStr === todayKey;
            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => openEditDayModal(cell.dateStr)}
                className={`rounded-lg py-2 text-center transition hover:bg-slate-100 hover:ring-2 hover:ring-slate-300 ${!isCurrent ? "text-neutral-300" : ""} ${isToday ? "ring-2 ring-neutral-700 ring-offset-1" : ""}`}
              >
                <div className="font-semibold text-neutral-800">{cell.dayNum}</div>
                {rec && (rec.wakeTime || rec.bedTime) && (
                  <div className="mt-1 hidden flex-col items-center gap-0.5 text-center text-sm font-medium tabular-nums text-neutral-600 sm:flex">
                    {rec.wakeTime && <span>↑ {rec.wakeTime}</span>}
                    {rec.wakeTime && rec.bedTime && <div className="my-0.5 w-14 border-t border-neutral-300" />}
                    {rec.bedTime && <span>↓ {rec.bedTime}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {/* 달력 월 기준 통계: 모바일 2x2, PC 4열 (글래스모피즘 + 호버) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-neutral-200/80 mt-4">
          <div
            className="rounded-xl border border-white/20 bg-white/40 backdrop-blur-md px-3 py-3 cursor-default shadow-sm transition duration-200 hover:bg-white/60 hover:border-neutral-300 hover:shadow-md"
            onMouseEnter={(e) => setStatTooltip({ content: "이번 달 평균 수면시간", x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setStatTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
            onMouseLeave={() => setStatTooltip(null)}
          >
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500 mb-0.5">Avg. Sleep</p>
            <p className="text-sm sm:text-base font-semibold text-neutral-800 tabular-nums">
              {monthStats.avgSleepMins != null ? formatSleepDuration(monthStats.avgSleepMins) : "—"}
            </p>
          </div>
          <div
            className="rounded-xl border border-white/20 bg-white/40 backdrop-blur-md px-3 py-3 cursor-default shadow-sm transition duration-200 hover:bg-white/60 hover:border-neutral-300 hover:shadow-md"
            onMouseEnter={(e) => setStatTooltip({ content: "이번 달 가장 늦게 일어난 시간", x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setStatTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
            onMouseLeave={() => setStatTooltip(null)}
          >
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500 mb-0.5">Latest Wake</p>
            <p className="text-sm sm:text-base font-semibold text-neutral-800 tabular-nums">{monthStats.latestWake ?? "—"}</p>
          </div>
          <div
            className="rounded-xl border border-white/20 bg-white/40 backdrop-blur-md px-3 py-3 cursor-default shadow-sm transition duration-200 hover:bg-white/60 hover:border-neutral-300 hover:shadow-md"
            onMouseEnter={(e) => setStatTooltip({ content: "이번 달 가장 일찍 일어난 시간", x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setStatTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
            onMouseLeave={() => setStatTooltip(null)}
          >
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500 mb-0.5">Earliest Wake</p>
            <p className="text-sm sm:text-base font-semibold text-neutral-800 tabular-nums">{monthStats.earliestWake ?? "—"}</p>
          </div>
          <div
            className="rounded-xl border border-white/20 bg-white/40 backdrop-blur-md px-3 py-3 cursor-default shadow-sm transition duration-200 hover:bg-white/60 hover:border-neutral-300 hover:shadow-md"
            onMouseEnter={(e) => setStatTooltip({ content: <><span className="block">이번 달 골든타임 준수율</span><span className="block">: 8시 기상 성공 일수 ÷ 해당 월 일수</span></>, x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setStatTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
            onMouseLeave={() => setStatTooltip(null)}
          >
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500 mb-0.5">Golden Time %</p>
            <p className="text-sm sm:text-base font-semibold text-neutral-800 tabular-nums">
              {monthStats.goldenTimePct != null ? `${monthStats.goldenTimePct}%` : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* 날짜 클릭 시 수정 모달 (일주일/달력) */}
      {editDayModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setEditDayModal(null)}
            role="dialog"
            aria-modal="true"
            aria-label="수면 수정"
          >
            <Card
              className="w-full max-w-sm space-y-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">
                {new Date(editDayModal + "T12:00:00").toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </h3>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-neutral-500">기상</label>
                  {data[editDayModal]?.wakeTime != null && (
                    <button
                      type="button"
                      onClick={clearEditDayWake}
                      className="text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <TimeInputWithAmPm
                  value={editDayWake}
                  onChange={setEditDayWake}
                  onSubmit={saveEditDayModal}
                  className="mt-1 w-full"
                  inputClassName="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-neutral-500">취침 (전날 밤)</label>
                  {data[editDayModal]?.bedTime != null && (
                    <button
                      type="button"
                      onClick={clearEditDayBed}
                      className="text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <TimeInputWithAmPm
                  value={editDayBed}
                  onChange={setEditDayBed}
                  onSubmit={saveEditDayModal}
                  className="mt-1 w-full"
                  inputClassName="w-full"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditDayModal(null)}
                  className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveEditDayModal}
                  className="flex-1 rounded-xl bg-gradient-to-r from-neutral-800 to-neutral-900 py-2.5 text-sm font-medium text-white transition hover:from-neutral-700 hover:to-neutral-800"
                >
                  저장
                </button>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </div>
  );
}
