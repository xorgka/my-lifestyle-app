"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayTimetable, NamedTimetableTemplate } from "@/lib/timetableDb";

export type TimetableTemplateLibraryModalProps = {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  dateLabel: string;
  day: DayTimetable | null;
  templates: NamedTimetableTemplate[];
  /** 우측 하단 「적용」에 쓸 템플릿 id */
  selectedApplyId: string | null;
  onSelectedApplyIdChange: (id: string | null) => void;
  /** 지금 보이는 날짜의 시간표로 항상 새 템플릿 한 줄 추가 */
  onAddTemplate: (name: string) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
};

export function TimetableTemplateLibraryModal({
  open,
  onClose,
  dateKey,
  dateLabel,
  day,
  templates,
  selectedApplyId,
  onSelectedApplyIdChange,
  onAddTemplate,
  onDeleteTemplate,
}: TimetableTemplateLibraryModalProps) {
  const [newNameDraft, setNewNameDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setNewNameDraft("");
  }, [open]);

  const selected = useMemo(
    () => (selectedApplyId ? templates.find((t) => t.id === selectedApplyId) ?? null : null),
    [selectedApplyId, templates]
  );

  const slotCount = selected?.slots.length ?? 0;
  const itemCount = useMemo(() => {
    if (!selected) return 0;
    return selected.slots.reduce((n, s) => n + (Array.isArray(s.items) ? s.items.length : 0), 0);
  }, [selected]);

  const currentDaySlotCount = day?.slots.length ?? 0;
  const currentDayItemCount = useMemo(() => {
    if (!day) return 0;
    return day.slots.reduce((n, s) => n + s.items.length, 0);
  }, [day]);

  const handleAdd = async () => {
    if (!day || day.slots.length === 0) return;
    const name = newNameDraft.trim() || "이름 없음";
    setBusy(true);
    try {
      await onAddTemplate(name);
      setNewNameDraft("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedApplyId || !selected) return;
    if (!window.confirm(`「${selected.name}」템플릿을 삭제할까요?`)) return;
    setBusy(true);
    try {
      await onDeleteTemplate(selectedApplyId);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="relative z-10 mx-auto w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">템플릿</h2>
          <p className="mt-1 text-sm text-neutral-600">
            <span className="font-medium text-neutral-800">{dateLabel}</span> ({dateKey})에 보이는 시간표를 아래에서
            이름 붙여 <strong className="font-medium text-neutral-800">추가</strong>할 수 있어요. 적용할 템플릿을 고른 뒤
            닫고, 화면 <strong className="font-medium text-neutral-800">오른쪽 아래 「적용」</strong>을 누르면{" "}
            <strong className="font-medium text-neutral-800">지금 보는 날짜</strong>에 그 템플릿이 들어갑니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="닫기"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-neutral-400">적용할 템플릿</p>
      {templates.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">아직 없어요. 아래에서 첫 템플릿을 추가하세요.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectedApplyIdChange(t.id)}
                className={`max-w-full truncate rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                  selectedApplyId === t.id
                    ? "border-neutral-800 bg-neutral-800 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
                }`}
              >
                {t.name || "이름 없음"}
              </button>
            ))}
          </div>
          {selected && (
            <p className="mt-2 text-xs text-neutral-500">
              선택됨 · 시간대 {slotCount}개 · 항목 {itemCount}개
            </p>
          )}
          {selectedApplyId && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              선택한 템플릿 삭제
            </button>
          )}
        </>
      )}

      <div className="mt-6 border-t border-neutral-100 pt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">지금 날짜 시간표를 새 템플릿으로 추가</p>
        <p className="mt-1 text-xs text-neutral-500">
          방금 수정한 내용까지 포함해요. 시간대 {currentDaySlotCount}개 · 항목 {currentDayItemCount}개
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="timetable-new-template-name">
              새 템플릿 이름
            </label>
            <input
              id="timetable-new-template-name"
              type="text"
              value={newNameDraft}
              onChange={(e) => setNewNameDraft(e.target.value)}
              placeholder="템플릿 이름"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none ring-neutral-800 focus:ring-2"
              disabled={busy}
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !day || day.slots.length === 0}
            className="shrink-0 rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? "추가 중…" : "추가"}
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
