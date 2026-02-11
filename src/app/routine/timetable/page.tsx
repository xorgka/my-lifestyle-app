"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  loadTimetableForDate,
  saveTimetableForDate,
  getTodayKey,
  getDateKeyOffset,
  genId,
  type DayTimetable,
  type TimetableSlot,
} from "@/lib/timetableDb";
import {
  loadTimetableRoutineLinks,
  getRoutineIdByTimetableId,
  setTimetableRoutineLink,
  removeLinkByTimetableId,
  copyLinksForCopiedDay,
} from "@/lib/timetableRoutineLinks";
import { loadRoutineItems, toggleRoutineCompletion } from "@/lib/routineDb";
import type { RoutineItem } from "@/lib/routineDb";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_HISTORY = 30;

function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = getTodayKey();
  if (key === today) return "오늘";
  const yesterday = getDateKeyOffset(today, -1);
  const tomorrow = getDateKeyOffset(today, 1);
  if (key === yesterday) return "어제";
  if (key === tomorrow) return "내일";
  return `${m}월 ${d}일 (${WEEKDAY[date.getDay()]})`;
}

function formatDateShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${y}. ${m}. ${d}. (${WEEKDAY[date.getDay()]})`;
}

/** 시간 숫자 → "9시", "10시" 표기 */
function formatTimeDisplay(time: string): string {
  const n = parseInt(String(time).trim(), 10);
  if (Number.isNaN(n) || n < 0 || n > 24) return "—";
  return `${n}시`;
}

export default function TimetablePage() {
  const [dateKey, setDateKey] = useState(() => getTodayKey());
  const [day, setDay] = useState<DayTimetable | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ dateKey: string; day: DayTimetable }[]>([]);
  const [timeModal, setTimeModal] = useState<{ slotId: string; time: string } | null>(null);
  const [itemModal, setItemModal] = useState<{ slotId: string; itemId: string; text: string } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [routineLinks, setRoutineLinks] = useState<Record<string, number>>({});
  const [reorderState, setReorderState] = useState<{ slotId: string; itemId: string } | null>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTargetRef = useRef<Element | null>(null);
  const longPressPointerIdRef = useRef<number>(0);
  const dayRef = useRef<DayTimetable | null>(null);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  useEffect(() => {
    loadRoutineItems().then(setRoutineItems);
  }, []);
  useEffect(() => {
    loadTimetableRoutineLinks().then(setRoutineLinks);
  }, []);

  const load = useCallback(async (key: string) => {
    const result = await loadTimetableForDate(key);
    setDay(result.day);
    setHistory([]);
    if (result.copiedFrom) {
      const prevResult = await loadTimetableForDate(result.copiedFrom);
      const currentLinks = await loadTimetableRoutineLinks();
      const newLinks = await copyLinksForCopiedDay(prevResult.day, result.day, currentLinks);
      setRoutineLinks(newLinks);
    }
  }, []);

  useEffect(() => {
    load(dateKey);
  }, [dateKey, load]);

  const persist = useCallback(
    async (next: DayTimetable, pushHistory = true) => {
      if (!day || !pushHistory) {
        setDay(next);
        setSaving(true);
        await saveTimetableForDate(dateKey, next);
        setSaving(false);
        return;
      }
      setHistory((h) => {
        const nextHistory = [...h, { dateKey, day }].slice(-MAX_HISTORY);
        return nextHistory;
      });
      setDay(next);
      setSaving(true);
      await saveTimetableForDate(dateKey, next);
      setSaving(false);
    },
    [dateKey, day]
  );

  const undo = useCallback(async () => {
    if (history.length === 0 || !day) return;
    const prev = history[history.length - 1];
    if (prev.dateKey !== dateKey) return;
    setHistory((h) => h.slice(0, -1));
    setDay(prev.day);
    setSaving(true);
    await saveTimetableForDate(dateKey, prev.day);
    setSaving(false);
  }, [dateKey, day, history]);

  const goPrev = () => setDateKey((k) => getDateKeyOffset(k, -1));
  const goNext = () => setDateKey((k) => getDateKeyOffset(k, 1));

  const toggleComplete = useCallback(
    (itemId: string) => {
      if (!day) return;
      const completed = new Set(day.completedIds);
      if (completed.has(itemId)) completed.delete(itemId);
      else completed.add(itemId);
      const next = { ...day, completedIds: Array.from(completed) };
      const isNowCompleted = completed.has(itemId);
      persist(next).then(() => {
        const routineId = getRoutineIdByTimetableId(routineLinks, itemId);
        if (routineId != null) {
          toggleRoutineCompletion(dateKey, routineId, isNowCompleted).catch(() => {});
        }
      });
    },
    [day, persist, dateKey, routineLinks]
  );

  const updateSlotTime = useCallback(
    (slotId: string, time: string) => {
      if (!day) return;
      const slots = day.slots.map((s) => (s.id === slotId ? { ...s, time: time.trim() || s.time } : s));
      persist({ ...day, slots });
    },
    [day, persist]
  );

  const updateItemText = useCallback(
    (slotId: string, itemId: string, text: string) => {
      if (!day) return;
      const slots = day.slots.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          items: s.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
        };
      });
      persist({ ...day, slots });
    },
    [day, persist]
  );

  const deleteItem = useCallback(
    (slotId: string, itemId: string) => {
      if (!day) return;
      const nextLinks = { ...routineLinks };
      delete nextLinks[itemId];
      removeLinkByTimetableId(itemId, routineLinks).then(() => setRoutineLinks(nextLinks));
      const slots = day.slots.map((s) => {
        if (s.id !== slotId) return s;
        return { ...s, items: s.items.filter((i) => i.id !== itemId) };
      });
      persist({ ...day, slots, completedIds: day.completedIds.filter((id) => id !== itemId) });
    },
    [day, persist, routineLinks]
  );

  /** 시간대 + 항목 추가. 반환: 새로 추가된 항목 id 목록 (연동 설정용) */
  const addSlotWithItems = useCallback(
    async (
      time: string,
      itemTexts: string[],
      routineIdsByIndex?: (number | null)[]
    ): Promise<string[]> => {
      if (!day || itemTexts.length === 0) return [];
      const t = time.trim();
      const newItems = itemTexts.map((text) => ({ id: genId(), text: text.trim() || "" }));
      const existing = day.slots.find((s) => String(s.time).trim() === t);
      if (existing) {
        const slots = day.slots.map((s) =>
          s.id === existing.id ? { ...s, items: [...s.items, ...newItems] } : s
        );
        await persist({ ...day, slots }, true);
      } else {
        const newSlot: TimetableSlot = {
          id: genId(),
          time: t || "0",
          items: newItems,
        };
        const num = (v: string) => parseInt(v, 10) || 0;
        const sorted = [...day.slots, newSlot].sort((a, b) => num(a.time) - num(b.time));
        await persist({ ...day, slots: sorted }, true);
      }
      routineIdsByIndex?.forEach((rid, i) => {
        if (newItems[i] && rid != null) {
          const tid = newItems[i].id;
          setTimetableRoutineLink(tid, rid, { ...routineLinks, [tid]: rid }).then(() => {
            setRoutineLinks((prev) => ({ ...prev, [tid]: rid }));
          });
        }
      });
      return newItems.map((i) => i.id);
    },
    [day, persist, routineLinks]
  );

  const deleteSlot = useCallback(
    (slotId: string) => {
      if (!day) return;
      const slot = day.slots.find((s) => s.id === slotId);
      const itemIds = new Set(slot?.items.map((i) => i.id) ?? []);
      persist({
        ...day,
        slots: day.slots.filter((s) => s.id !== slotId),
        completedIds: day.completedIds.filter((id) => !itemIds.has(id)),
      });
    },
    [day, persist]
  );

  const LONG_PRESS_MS = 450;

  const handleItemPointerDown = useCallback(
    (slotId: string, itemId: string, e: React.PointerEvent) => {
      if (longPressTimerRef.current) return;
      longPressTargetRef.current = e.currentTarget as Element;
      longPressPointerIdRef.current = e.pointerId;
      const clearTimer = () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      const onUp = () => {
        clearTimer();
      };
      document.addEventListener("pointerup", onUp, { once: true });
      document.addEventListener("pointercancel", onUp, { once: true });
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        try {
          longPressTargetRef.current?.setPointerCapture?.(longPressPointerIdRef.current);
        } catch {}
        setReorderState({ slotId, itemId });
        const onMove = (ev: PointerEvent) => {
          ev.preventDefault();
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const row = el?.closest("tr[data-slot-id][data-item-id]") as HTMLElement | null;
          if (!row || !dayRef.current) return;
          const overSlotId = row.getAttribute("data-slot-id");
          const overItemId = row.getAttribute("data-item-id");
          if (overSlotId !== slotId || !overItemId || overItemId === itemId) return;
          const slot = dayRef.current.slots.find((s) => s.id === slotId);
          if (!slot) return;
          const items = [...slot.items];
          const fromIdx = items.findIndex((i) => i.id === itemId);
          const toIdx = items.findIndex((i) => i.id === overItemId);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
          const [removed] = items.splice(fromIdx, 1);
          items.splice(toIdx, 0, removed);
          const next: DayTimetable = {
            ...dayRef.current,
            slots: dayRef.current.slots.map((s) =>
              s.id === slotId ? { ...s, items } : s
            ),
          };
          dayRef.current = next;
          setDay(next);
        };
        const onPointerUp = () => {
          try {
            longPressTargetRef.current?.releasePointerCapture?.(longPressPointerIdRef.current);
          } catch {}
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onPointerUp);
          document.removeEventListener("pointercancel", onPointerUp);
          setReorderState(null);
          if (dayRef.current) {
            persist(dayRef.current, false);
          }
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onPointerUp, { once: true });
        document.addEventListener("pointercancel", onPointerUp, { once: true });
      }, LONG_PRESS_MS);
    },
    [persist]
  );

  if (!day) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-neutral-500">불러오는 중…</p>
      </div>
    );
  }

  const totalItems = day.slots.reduce((sum, s) => sum + s.items.length, 0);
  const completedCount = day.completedIds.length;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <Link
          href="/routine"
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 text-neutral-600 hover:text-neutral-900 sm:min-h-0 sm:min-w-0"
          aria-label="루틴으로"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">루틴으로</span>
        </Link>
        <div className="order-last w-full text-center sm:order-none sm:w-auto">
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{formatDateLabel(dateKey)}</h1>
          <p className="mt-0.5 text-xs text-neutral-400 sm:text-sm">{formatDateShort(dateKey)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0"
            aria-label="이전 날짜"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0"
            aria-label="다음 날짜"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs text-neutral-600 sm:flex-initial sm:px-4 sm:py-3 sm:text-sm">
          총 <span className="font-semibold text-neutral-800">{totalItems}</span>개 항목 중{" "}
          <span className="font-semibold text-neutral-800">{completedCount}</span>개 완료
          {saving && <span className="ml-1 text-neutral-400 sm:ml-2">· 저장 중</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 disabled:pointer-events-none sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0 ${
              history.length === 0 ? "opacity-20" : "opacity-100"
            }`}
            aria-label="이전으로"
            title="이전으로"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="min-h-[44px] rounded-xl border border-neutral-200 bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 sm:py-3"
          >
            추가
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto touch-scroll-x">
          <table className="w-full min-w-[320px] border-collapse text-left sm:min-w-[480px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-black">
                <th className="w-14 shrink-0 px-4 py-3 text-center text-[15px] font-semibold uppercase tracking-wider text-white md:w-40">
                  시간
                </th>
                <th className="min-w-0 px-4 py-3 text-center text-[15px] font-semibold uppercase tracking-wider text-white">지금 할 일</th>
                <th className="w-14 shrink-0 px-2 py-3 text-center text-[15px] font-semibold uppercase tracking-wider text-white">
                  완료
                </th>
              </tr>
            </thead>
            <tbody>
              {day.slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  completedIds={day.completedIds}
                  reorderState={reorderState}
                  onTimeDoubleClick={() => setTimeModal({ slotId: slot.id, time: slot.time })}
                  onItemDoubleClick={(itemId, text) => setItemModal({ slotId: slot.id, itemId, text })}
                  onItemPointerDown={handleItemPointerDown}
                  onToggleComplete={toggleComplete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 전체 화면(사이드바 포함) 어두운 배경 + 가운데 모달 — body에 포털 */}
      {(timeModal || itemModal || addModalOpen) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setTimeModal(null);
                setItemModal(null);
                setAddModalOpen(false);
              }
            }}
          >
            {timeModal && (
              <TimeEditModal
                initialTime={timeModal.time}
                onSave={(time) => {
                  updateSlotTime(timeModal.slotId, time);
                  setTimeModal(null);
                }}
                onDelete={() => {
                  deleteSlot(timeModal.slotId);
                  setTimeModal(null);
                }}
                onCancel={() => setTimeModal(null)}
                timeInputRef={timeInputRef}
              />
            )}
            {itemModal && (
              <ItemEditModal
                initialText={itemModal.text}
                initialRoutineId={getRoutineIdByTimetableId(routineLinks, itemModal.itemId)}
                routineItems={routineItems}
                onSave={(text, routineId) => {
                  updateItemText(itemModal.slotId, itemModal.itemId, text);
                  const nextLinks = { ...routineLinks };
                  if (routineId == null) delete nextLinks[itemModal.itemId];
                  else nextLinks[itemModal.itemId] = routineId;
                  setTimetableRoutineLink(itemModal.itemId, routineId ?? null, routineLinks).then(() => {
                    setRoutineLinks(nextLinks);
                  });
                  setItemModal(null);
                }}
                onDelete={() => {
                  deleteItem(itemModal.slotId, itemModal.itemId);
                  setItemModal(null);
                }}
                onCancel={() => setItemModal(null)}
                itemInputRef={itemInputRef}
              />
            )}
            {addModalOpen && (
              <AddSlotModal
                routineItems={routineItems}
                onAdd={async (time, itemTexts, routineIdsByIndex) => {
                  await addSlotWithItems(time, itemTexts, routineIdsByIndex);
                  setAddModalOpen(false);
                }}
                onCancel={() => setAddModalOpen(false)}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

function AddSlotModal({
  routineItems,
  onAdd,
  onCancel,
}: {
  routineItems: RoutineItem[];
  onAdd: (time: string, itemTexts: string[], routineIdsByIndex?: (number | null)[]) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [time, setTime] = useState("");
  const [items, setItems] = useState<{ text: string; routineId: number | null }[]>([{ text: "", routineId: null }]);

  const addItemRow = () => setItems((prev) => [...prev, { text: "", routineId: null }]);
  const setItemAt = (idx: number, value: string) =>
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], text: value };
      return next;
    });
  const setRoutineAt = (idx: number, routineId: number | null) =>
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], routineId };
      return next;
    });
  const removeItemAt = (idx: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleSubmit = () => {
    const nonEmpty = items.filter((i) => i.text.trim());
    const texts = nonEmpty.map((i) => i.text.trim());
    if (!time.trim() || texts.length === 0) return;
    const routineIdsByIndex = nonEmpty.map((i) => i.routineId);
    onAdd(time.trim(), texts, routineIdsByIndex.length ? routineIdsByIndex : undefined);
  };

  return (
    <div
      className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-neutral-900">시간대 추가</h3>
      <label className="mt-3 block text-xs font-medium text-neutral-500">시간</label>
      <input
        type="text"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-200 px-4 py-2 text-neutral-800 outline-none focus:border-neutral-400"
        placeholder="예: 9"
      />
      <label className="mt-3 block text-xs font-medium text-neutral-500">항목</label>
      <div className="mt-1 space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={item.text}
                onChange={(e) => setItemAt(idx, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-neutral-800 outline-none focus:border-neutral-400"
                placeholder="항목"
              />
              <button
                type="button"
                onClick={() => removeItemAt(idx)}
                className="shrink-0 rounded-lg border border-neutral-200 px-2 text-neutral-500 hover:bg-neutral-50"
                aria-label="삭제"
              >
                −
              </button>
            </div>
            <select
              value={item.routineId ?? ""}
              onChange={(e) => setRoutineAt(idx, e.target.value === "" ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="">루틴 연동 안 함</option>
              {routineItems.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title || "제목 없음"}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          onClick={addItemRow}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          + 항목 추가
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          추가
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function TimeEditModal({
  initialTime,
  onSave,
  onDelete,
  onCancel,
  timeInputRef,
}: {
  initialTime: string;
  onSave: (time: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  timeInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [time, setTime] = useState(initialTime);
  useEffect(() => {
    timeInputRef.current?.focus();
  }, [timeInputRef]);
  return (
    <div
      className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-neutral-900">시간 변경</h3>
      <input
        ref={timeInputRef}
        type="text"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="mt-3 w-full rounded-lg border border-neutral-200 px-4 py-2 text-neutral-800 outline-none focus:border-neutral-400"
        placeholder="예: 9"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(time.trim() || initialTime)}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          확인
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
        >
          시간대 삭제
        </button>
      </div>
    </div>
  );
}

function ItemEditModal({
  initialText,
  initialRoutineId,
  routineItems,
  onSave,
  onDelete,
  onCancel,
  itemInputRef,
}: {
  initialText: string;
  initialRoutineId: number | null;
  routineItems: RoutineItem[];
  onSave: (text: string, routineId?: number | null) => void;
  onDelete: () => void;
  onCancel: () => void;
  itemInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [text, setText] = useState(initialText);
  const [routineId, setRoutineId] = useState<number | null>(initialRoutineId);
  useEffect(() => {
    itemInputRef.current?.focus();
  }, [itemInputRef]);
  return (
    <div
      className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-neutral-900">항목 수정</h3>
      <input
        ref={itemInputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(text.trim(), routineId);
          }
        }}
        className="mt-3 w-full rounded-lg border border-neutral-200 px-4 py-2 text-neutral-800 outline-none focus:border-neutral-400"
        placeholder="항목 이름"
      />
      <label className="mt-3 block text-xs font-medium text-neutral-500">루틴 연동</label>
      <select
        value={routineId ?? ""}
        onChange={(e) => setRoutineId(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-400"
      >
        <option value="">연동 안 함</option>
        {routineItems.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title || "제목 없음"}
          </option>
        ))}
      </select>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(text.trim(), routineId)}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          확인
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
        >
          항목 삭제
        </button>
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  completedIds,
  reorderState,
  onTimeDoubleClick,
  onItemDoubleClick,
  onItemPointerDown,
  onToggleComplete,
}: {
  slot: TimetableSlot;
  completedIds: string[];
  reorderState: { slotId: string; itemId: string } | null;
  onTimeDoubleClick: () => void;
  onItemDoubleClick: (itemId: string, text: string) => void;
  onItemPointerDown: (slotId: string, itemId: string, e: React.PointerEvent) => void;
  onToggleComplete: (itemId: string) => void;
}) {
  const hasItems = slot.items.length > 0;
  const allCompleted = hasItems && slot.items.every((item) => completedIds.includes(item.id));
  return (
    <>
      {hasItems ? slot.items.map((item, idx) => {
        const isCompleted = completedIds.includes(item.id);
        const isLastInSlot = idx === slot.items.length - 1;
        const isDragging = reorderState?.slotId === slot.id && reorderState?.itemId === item.id;
        return (
          <tr
            key={item.id}
            data-slot-id={slot.id}
            data-item-id={item.id}
            className={`${isLastInSlot ? "border-b-2 border-neutral-200" : "border-b border-neutral-200"} ${isDragging ? "bg-neutral-100" : ""}`}
            onPointerDown={(e) => {
              if (e.button === 0) onItemPointerDown(slot.id, item.id, e);
            }}
          >
            {idx === 0 ? (
              <td
                rowSpan={slot.items.length}
                className={`w-14 shrink-0 align-top border-r border-neutral-100 px-4 py-2 md:w-40 ${allCompleted ? "bg-white" : "bg-neutral-50"}`}
              >
                <button
                  type="button"
                  onDoubleClick={onTimeDoubleClick}
                  className={`w-full cursor-pointer rounded px-1 py-0.5 text-center text-lg font-bold outline-none hover:bg-neutral-100 sm:text-xl md:text-2xl ${allCompleted ? "text-neutral-100" : "text-neutral-800"}`}
                >
                  {formatTimeDisplay(slot.time)}
                </button>
              </td>
            ) : null}
            <td className={`min-w-0 px-4 py-2 ${isCompleted ? "bg-white" : ""}`}>
              <button
                type="button"
                onDoubleClick={() => onItemDoubleClick(item.id, item.text)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded py-0.5 text-left text-base font-semibold outline-none hover:bg-neutral-100 sm:text-lg md:text-xl ${isCompleted ? "text-neutral-100" : "text-neutral-800"}`}
              >
                <span className={`flex shrink-0 ${isCompleted ? "text-neutral-100" : "text-neutral-400"}`} aria-hidden>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                {item.text || "항목"}
              </button>
            </td>
            <td className={`w-14 shrink-0 px-2 py-2 text-center align-top ${isCompleted ? "bg-white" : ""}`}>
              <button
                type="button"
                onClick={() => onToggleComplete(item.id)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition ${
                  isCompleted
                    ? "border-neutral-800 bg-neutral-800 text-white"
                    : "border-neutral-300 text-transparent hover:border-neutral-400"
                }`}
                aria-label={isCompleted ? "완료 해제" : "완료"}
              >
                {isCompleted && (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </td>
          </tr>
        );
      }      ) : (
        <tr className="border-b-2 border-neutral-200">
          <td className="w-14 shrink-0 border-r border-neutral-100 bg-neutral-50 px-4 py-2 md:w-40">
            <button
              type="button"
              onDoubleClick={onTimeDoubleClick}
              className="w-full cursor-pointer rounded px-1 py-0.5 text-center text-lg font-bold text-neutral-800 outline-none hover:bg-neutral-100 sm:text-xl md:text-2xl"
            >
              {formatTimeDisplay(slot.time)}
            </button>
          </td>
          <td className="px-4 py-2" colSpan={2} />
        </tr>
      )}
    </>
  );
}
