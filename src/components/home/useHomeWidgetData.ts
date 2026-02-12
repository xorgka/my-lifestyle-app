"use client";

import { useEffect, useState } from "react";
import { loadJournalEntries } from "@/lib/journal";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import {
  loadTimetableForDate,
  saveTimetableForDate,
  getTodayKey,
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

export function getCurrentSlot(day: DayTimetable | null): TimetableSlot | null {
  if (!day || day.slots.length === 0) return null;
  const sorted = [...day.slots].sort((a, b) => Number(a.time) - Number(b.time));
  const currentHour = new Date().getHours();
  for (let i = 0; i < sorted.length; i++) {
    const slotTime = Number(sorted[i].time);
    const nextTime = i + 1 < sorted.length ? Number(sorted[i + 1].time) : 24;
    if (currentHour >= slotTime && currentHour < nextTime) return sorted[i];
  }
  return sorted[0];
}

function getNextSlotHour(day: DayTimetable | null, currentSlot: TimetableSlot | null): number {
  if (!day || !currentSlot || day.slots.length === 0) return 24;
  const sorted = [...day.slots].sort((a, b) => Number(a.time) - Number(b.time));
  const idx = sorted.findIndex((s) => s.id === currentSlot.id);
  if (idx < 0 || idx + 1 >= sorted.length) return 24;
  return Number(sorted[idx + 1].time);
}

export function getRemainingToNextSlot(nextHour: number, now: Date): string {
  const end = new Date(now);
  if (nextHour >= 24) {
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
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
    }).catch(() => {
      if (!cancelled) setRoutineProgress(0);
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
    setTemplateLinks(loadTimetableTemplateLinks());
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const currentSlot = getCurrentSlot(dayTimetable);
  const completedIds = dayTimetable?.completedIds ?? [];
  const nextSlotHour = getNextSlotHour(dayTimetable, currentSlot);
  const remainingText = currentSlot ? getRemainingToNextSlot(nextSlotHour, now) : null;

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
    const routineId = getRoutineIdByTimetableId(routineLinks, itemId, slotTime, itemText, templateLinks);
    if (routineId != null) {
      toggleRoutineCompletion(getTodayKey(), routineId, !isCompleted).catch(() => {});
    }
  };

  return {
    journalWritten,
    routineProgress,
    dayTimetable,
    currentSlot,
    completedIds,
    nextSlotHour,
    remainingText,
    now,
    handleTimetableToggle,
  };
}
