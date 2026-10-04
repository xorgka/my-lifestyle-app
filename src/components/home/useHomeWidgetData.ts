"use client";

import { useEffect, useState } from "react";
import { syncExerciseFromItem } from "@/lib/exerciseLink";
import { loadJournalEntries } from "@/lib/journal";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { loadSleepData } from "@/lib/sleepDb";
import {
  loadTimetableForDate,
  saveTimetableForDate,
  getTodayKey,
  sortTimetableSlots,
  getStartTimeOverrideForKey,
  syncStartTimeOverridesFromSupabase,
  getSlotDisplayHour,
  type DayTimetable,
  type TimetableSlot,
} from "@/lib/timetableDb";
import {
  loadTimetableRoutineLinks,
  loadTimetableTemplateLinks,
  getRoutineIdByTimetableId,
} from "@/lib/timetableRoutineLinks";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDisplayHour(slot: TimetableSlot, firstSlotHour: number, startTimeOverride: number): number {
  return getSlotDisplayHour(slot.time, firstSlotHour, startTimeOverride);
}

/** 지금 시간대. 오늘 마지막 시간대(예: 0시 취침)는 다음 날 첫 시간대(예: 8시 기상) 전까지 이어짐 */
export function getCurrentSlot(
  day: DayTimetable | null,
  startTimeOverride: number | null
): TimetableSlot | null {
  if (!day || day.slots.length === 0) return null;
  const sorted = sortTimetableSlots(day.slots);
  const currentHour = new Date().getHours();
  const firstSlotHour = parseInt(String(sorted[0].time).trim(), 10) || 0;

  if (startTimeOverride != null && !Number.isNaN(firstSlotHour)) {
    for (let i = 0; i < sorted.length; i++) {
      const start = getDisplayHour(sorted[i], firstSlotHour, startTimeOverride);
      const end = getDisplayHour(sorted[(i + 1) % sorted.length], firstSlotHour, startTimeOverride);
      const inSlot =
        start <= end
          ? currentHour >= start && currentHour < end
          : currentHour >= start || currentHour < end;
      if (inSlot) return sorted[i];
    }
    return sorted[0];
  }

  for (let i = 0; i < sorted.length; i++) {
    const start = Number(sorted[i].time);
    const end = Number(sorted[(i + 1) % sorted.length].time);
    const inSlot = start <= end
      ? currentHour >= start && currentHour < end
      : currentHour >= start || currentHour < end;
    if (inSlot) return sorted[i];
  }
  return sorted[0];
}

/**
 * 지금 시간대가 끝나는 시각. 24 이상이면 내일(24 + 시).
 * 자정을 넘긴 시간대(예: 22시 시작, 지금 1시)는 끝이 오늘이고, 아직 자정 전이면 다음 경계가 시작보다 작을 때 내일.
 */
function nextBoundaryHour(curStart: number, nextStart: number): number {
  const nowHour = new Date().getHours();
  if (nowHour < curStart) return nextStart;
  return nextStart <= curStart ? nextStart + 24 : nextStart;
}

function getNextSlotHour(
  day: DayTimetable | null,
  currentSlot: TimetableSlot | null,
  startTimeOverride: number | null
): number {
  if (!day || !currentSlot || day.slots.length === 0) return 24;
  const sorted = sortTimetableSlots(day.slots);
  const idx = sorted.findIndex((s) => s.id === currentSlot.id);
  if (idx < 0) return 24;
  const firstSlotHour = parseInt(String(sorted[0].time).trim(), 10) || 0;
  const nextSlot = sorted[idx + 1];
  const useOverride = startTimeOverride != null && !Number.isNaN(firstSlotHour);
  const currentStart = useOverride ? getDisplayHour(currentSlot, firstSlotHour, startTimeOverride) : Number(currentSlot.time);

  // 오늘 마지막 시간대는 다음 날 첫 시간대에 끝남 (getCurrentSlot과 같은 기준)
  const boundarySlot = nextSlot ?? sorted[0];
  const nextStart = useOverride ? getDisplayHour(boundarySlot, firstSlotHour, startTimeOverride) : Number(boundarySlot.time);
  return nextBoundaryHour(currentStart, nextStart);
}

export function getRemainingToNextSlot(nextHour: number, now: Date): string {
  const end = new Date(now);
  if (nextHour >= 24) {
    end.setDate(end.getDate() + 1);
    end.setHours(nextHour - 24, 0, 0, 0);
  } else {
    end.setHours(nextHour, 0, 0, 0);
  }
  let ms = end.getTime() - now.getTime();
  if (ms <= 0) return "0:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useHomeWidgetData() {
  const [journalWritten, setJournalWritten] = useState<boolean | null>(null);
  const [routineProgress, setRoutineProgress] = useState<number | null>(null);
  const [routineCompleted, setRoutineCompleted] = useState<number>(0);
  const [routineTotal, setRoutineTotal] = useState<number>(0);
  const [todaySleepBedTime, setTodaySleepBedTime] = useState<string | undefined>(undefined);
  const [todaySleepWakeTime, setTodaySleepWakeTime] = useState<string | undefined>(undefined);
  const [dayTimetable, setDayTimetable] = useState<DayTimetable | null>(null);
  const [routineLinks, setRoutineLinks] = useState<Record<string, number>>({});
  const [templateLinks, setTemplateLinks] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    loadJournalEntries().then((entries) => {
      if (cancelled) return;
      const today = todayStr();
      setJournalWritten(entries.some((e) => e.date === today && e.content.trim().length > 0));
    }).catch(() => {
      if (!cancelled) setJournalWritten(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRoutineItems(), loadRoutineCompletions()]).then(([items, daily]) => {
      if (cancelled) return;
      const todayKey = getTodayKey();
      const completed = daily[todayKey] ?? [];
      const total = items.length;
      const pct = total === 0 ? 0 : Math.round((completed.length / total) * 100);
      setRoutineProgress(pct);
      setRoutineCompleted(completed.length);
      setRoutineTotal(total);
    }).catch(() => {
      if (!cancelled) {
        setRoutineProgress(0);
        setRoutineCompleted(0);
        setRoutineTotal(0);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSleepData().then(({ data }) => {
      if (cancelled) return;
      const key = getTodayKey();
      const rec = data[key];
      setTodaySleepBedTime(rec?.bedTime);
      setTodaySleepWakeTime(rec?.wakeTime);
    }).catch(() => {
      if (!cancelled) {
        setTodaySleepBedTime(undefined);
        setTodaySleepWakeTime(undefined);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTimetableForDate(getTodayKey()).then((result) => {
      if (!cancelled) setDayTimetable(result.day);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadTimetableRoutineLinks().then(setRoutineLinks);
    loadTimetableTemplateLinks().then(setTemplateLinks);
    syncStartTimeOverridesFromSupabase();
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const startTimeOverride = getStartTimeOverrideForKey(getTodayKey());
  const currentSlot = getCurrentSlot(dayTimetable, startTimeOverride);
  const completedIds = dayTimetable?.completedIds ?? [];
  const nextSlotHour = getNextSlotHour(dayTimetable, currentSlot, startTimeOverride);
  const remainingText = currentSlot ? getRemainingToNextSlot(nextSlotHour, now) : null;

  const sortedSlots = dayTimetable ? sortTimetableSlots(dayTimetable.slots) : [];
  const firstSlotHour =
    sortedSlots.length > 0 ? parseInt(String(sortedSlots[0].time).trim(), 10) : 0;
  /** 오늘 타임라인: 시간대마다 화면에 보일 시작 시각(0~23)과 끝 시각(다음 시간대 시작, 마지막은 null) */
  const timelineSlots = sortedSlots.map((slot, i) => {
    const hourOf = (t: TimetableSlot) =>
      startTimeOverride != null && !Number.isNaN(firstSlotHour)
        ? getDisplayHour(t, firstSlotHour, startTimeOverride)
        : Number(t.time) % 24;
    const next = sortedSlots[i + 1];
    return { slot, start: hourOf(slot), end: next ? hourOf(next) : null };
  });
  const currentSlotDisplayHour =
    currentSlot && startTimeOverride != null && !Number.isNaN(firstSlotHour)
      ? getDisplayHour(currentSlot, firstSlotHour, startTimeOverride)
      : currentSlot
        ? Number(currentSlot.time)
        : null;

  const handleTimetableToggle = async (itemId: string) => {
    if (!dayTimetable) return;
    let slotTime: string | undefined;
    let itemText: string | undefined;
    for (const slot of dayTimetable.slots) {
      const item = slot.items.find((i) => i.id === itemId);
      if (item) {
        slotTime = slot.time;
        itemText = item.text;
        break;
      }
    }
    const completed = new Set(dayTimetable.completedIds);
    const isCompleted = completed.has(itemId);
    if (isCompleted) completed.delete(itemId);
    else completed.add(itemId);
    const completedIdsNext = Array.from(completed);
    const next = { ...dayTimetable, completedIds: completedIdsNext };
    setDayTimetable(next);
    await saveTimetableForDate(getTodayKey(), next);
    // 항목 이름이 운동이면 그날 다이어트 운동에도 반영
    if (itemText) void syncExerciseFromItem(getTodayKey(), itemText, !isCompleted, itemId);
    const routineId = getRoutineIdByTimetableId(routineLinks, itemId, slotTime, itemText, templateLinks);
    if (routineId != null) {
      toggleRoutineCompletion(getTodayKey(), routineId, !isCompleted).catch(() => {});
    }
  };

  return {
    journalWritten,
    routineProgress,
    routineCompleted,
    routineTotal,
    todaySleepBedTime,
    todaySleepWakeTime,
    dayTimetable,
    currentSlot,
    currentSlotDisplayHour,
    completedIds,
    timelineSlots,
    nextSlotHour,
    remainingText,
    now,
    handleTimetableToggle,
  };
}
