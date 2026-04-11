"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayTimetable, NamedTimetableTemplate } from "@/lib/timetableDb";

const NEW_TAB_ID = "__new__";

export type TimetableTemplateLibraryModalProps = {
  open: boolean;
  mode: "save" | "apply";
  onClose: () => void;
  dateKey: string;
  dateLabel: string;
  day: DayTimetable | null;
  templates: NamedTimetableTemplate[];
  onRefreshTemplates: () => Promise<void>;
  onSaveCurrentToTemplate: (opts: { templateId: string | null; name: string }) => Promise<string>;
  onApplyTemplate: (templateId: string) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
};

export function TimetableTemplateLibraryModal({
  open,
  mode: initialMode,
  onClose,
  dateKey,
  dateLabel,
  day,
  templates,
  onRefreshTemplates,
  onSaveCurrentToTemplate,
  onApplyTemplate,
  onDeleteTemplate,
}: TimetableTemplateLibraryModalProps) {
  const [panelMode, setPanelMode] = useState<"save" | "apply">(initialMode);
  const [selectedId, setSelectedId] = useState<string>(NEW_TAB_ID);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPanelMode(initialMode);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    if (templates.length === 0) {
      setSelectedId(NEW_TAB_ID);
      setNameDraft("");
      return;
    }
    setSelectedId((prev) => {
      if (prev === NEW_TAB_ID) return NEW_TAB_ID;
      if (templates.some((t) => t.id === prev)) return prev;
      return templates[0].id;
    });
  }, [open, templates]);

  const selectedTemplate = useMemo(
    () => (selectedId === NEW_TAB_ID ? null : templates.find((t) => t.id === selectedId) ?? null),
    [selectedId, templates]
  );

  useEffect(() => {
    if (!open) return;
    if (selectedTemplate) setNameDraft(selectedTemplate.name);
    else if (selectedId === NEW_TAB_ID) setNameDraft("");
  }, [open, selectedId, selectedTemplate]);

  const slotCount = selectedTemplate?.slots.length ?? 0;
  const itemCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    return selectedTemplate.slots.reduce((n, s) => n + (Array.isArray(s.items) ? s.items.length : 0), 0);
  }, [selectedTemplate]);

  const currentDaySlotCount = day?.slots.length ?? 0;
  const currentDayItemCount = useMemo(() => {
    if (!day) return 0;
    return day.slots.reduce((n, s) => n + s.items.length, 0);
  }, [day]);

  const handleSave = async () => {
    if (!day || day.slots.length === 0) return;
    const name = nameDraft.trim() || "이름 없음";
    setBusy(true);
    try {
      const id = await onSaveCurrentToTemplate({
        templateId: selectedId === NEW_TAB_ID ? null : selectedId,
        name,
      });
      await onRefreshTemplates();
      setSelectedId(id);
      setNameDraft(name);
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (selectedId === NEW_TAB_ID || !selectedTemplate) return;
    setBusy(true);
    try {
      await onApplyTemplate(selectedId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === NEW_TAB_ID || !selectedTemplate) return;
    if (!window.confirm(`「${selectedTemplate.name}」템플릿을 삭제할까요?`)) return;
    setBusy(true);
    try {
      await onDeleteTemplate(selectedId);
      await onRefreshTemplates();
      setSelectedId(NEW_TAB_ID);
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
          <h2 className="text-lg font-semibold text-neutral-900">템플릿 라이브러리</h2>
          <p className="mt-1 text-sm text-neutral-500">
            적용·저장은 <span className="font-medium text-neutral-700">{dateLabel}</span> ({dateKey}) 기준이에요.
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

      <div className="mt-4 flex rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        <button
          type="button"
          onClick={() => setPanelMode("save")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
            panelMode === "save" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          저장하기
        </button>
        <button
          type="button"
          onClick={() => setPanelMode("apply")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
            panelMode === "apply" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          적용하기
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">템플릿</p>
        <div className="flex gap-1 overflow-x-auto pb-1 touch-scroll-x">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`shrink-0 max-w-[140px] truncate rounded-lg border px-3 py-2 text-sm font-medium transition ${
                selectedId === t.id
                  ? "border-neutral-800 bg-neutral-800 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {t.name || "이름 없음"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedId(NEW_TAB_ID)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              selectedId === NEW_TAB_ID
                ? "border-neutral-800 bg-neutral-800 text-white"
                : "border-dashed border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
            }`}
          >
            ＋ 새 템플릿
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
        <label className="block text-xs font-medium text-neutral-500">이름</label>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder={selectedId === NEW_TAB_ID ? "새 템플릿 이름" : "템플릿 이름"}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none ring-neutral-800 focus:ring-2"
          disabled={busy}
        />
        {selectedTemplate && (
          <p className="mt-3 text-xs text-neutral-500">
            이 템플릿: 시간대 {slotCount}개 · 항목 {itemCount}개
          </p>
        )}
        {selectedId === NEW_TAB_ID && (
          <p className="mt-3 text-xs text-neutral-500">새 템플릿으로 저장하면 라이브러리에 추가돼요.</p>
        )}
        {panelMode === "save" && (
          <p className="mt-2 text-xs text-neutral-500">
            지금 보고 있는 날: 시간대 {currentDaySlotCount}개 · 항목 {currentDayItemCount}개
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {panelMode === "apply" && selectedId !== NEW_TAB_ID && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mr-auto rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          닫기
        </button>
        {panelMode === "save" ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !day || day.slots.length === 0}
            className="rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? "저장 중…" : selectedId === NEW_TAB_ID ? "이 날짜로 새로 저장" : "이 날짜로 덮어쓰기"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || selectedId === NEW_TAB_ID || templates.length === 0}
            className="rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? "적용 중…" : "이 날짜에 적용"}
          </button>
        )}
      </div>

      {panelMode === "apply" && templates.length === 0 && (
        <p className="mt-3 text-center text-sm text-neutral-500">저장된 템플릿이 없어요. 먼저「저장하기」에서 만들어 보세요.</p>
      )}
    </div>
  );
}
