"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import {
  type JournalEntry,
  loadJournalEntries,
  saveJournalEntries,
  deleteJournalEntry,
} from "@/lib/journal";

const DRAFT_KEY = "my-lifestyle-journal-drafts";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type DraftSnapshot = { content: string; important: boolean };
function loadDrafts(): Record<string, DraftSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DraftSnapshot>;
  } catch {
    return {};
  }
}
function saveDraft(date: string, snapshot: DraftSnapshot | null): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadDrafts();
    if (snapshot) all[date] = snapshot;
    else delete all[date];
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {}
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${week})`;
}

/** 첫 문장 또는 첫 줄 (툴팁/미리보기용, 최대 50자) */
function firstLinePreview(content: string, maxLen = 50): string {
  const line = content.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return line.length > maxLen ? line.slice(0, maxLen) + "…" : line;
}

/** 마크다운 볼드 등 간단 렌더 (미리보기 탭용) */
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [draft, setDraft] = useState("");
  const [draftImportant, setDraftImportant] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  /** 초안 자동 저장 상태: idle | pending(2초 대기 중) | saved(방금 저장됨) */
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  /** 저장 버튼 클릭 시 토스트 */
  const [saveToast, setSaveToast] = useState(false);
  const [journalLoading, setJournalLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAllSearchResults, setShowAllSearchResults] = useState(false);
  const [showOnlyImportant, setShowOnlyImportant] = useState(false);
  const [viewMode, setViewMode] = useState<"write" | "preview">("preview");
  /** 달력 셀 호버 시 첫 문장 툴팁 (바로 표시, 크게) */
  const [cellTooltip, setCellTooltip] = useState<{ dateStr: string; text: string; x: number; y: number } | null>(null);
  const load = useCallback(async () => {
    setJournalLoading(true);
    try {
      const list = await loadJournalEntries();
      setEntries(list);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entryForDate = entries.find((e) => e.date === selectedDate);
  const currentContent = entryForDate?.content ?? "";
  const isToday = selectedDate === todayStr();

  useEffect(() => {
    const drafts = loadDrafts();
    const savedDraft = drafts[selectedDate];
    if (savedDraft) {
      setDraft(savedDraft.content);
      setDraftImportant(savedDraft.important);
    } else {
      setDraft(currentContent);
      setDraftImportant(entryForDate?.important ?? false);
    }
  }, [selectedDate, currentContent, entryForDate?.important]);

  useEffect(() => {
    if (currentContent === draft && (entryForDate?.important ?? false) === draftImportant) {
      setDraftSaveStatus("idle");
      return;
    }
    setDraftSaveStatus("pending");
    const t = setTimeout(() => {
      if (draft.trim() || draftImportant) {
        saveDraft(selectedDate, { content: draft, important: draftImportant });
      } else {
        saveDraft(selectedDate, null);
      }
      setDraftSaveStatus("saved");
      setTimeout(() => setDraftSaveStatus("idle"), 1500);
    }, 2000);
    return () => clearTimeout(t);
  }, [draft, draftImportant, selectedDate]);

  const save = () => {
    const next: JournalEntry[] = entries.filter((e) => e.date !== selectedDate);
    const now = new Date().toISOString();
    next.push({
      date: selectedDate,
      content: draft.trim(),
      createdAt: entryForDate?.createdAt ?? now,
      updatedAt: now,
      important: draftImportant,
    });
    next.sort((a, b) => b.date.localeCompare(a.date));
    setEntries(next);
    saveJournalEntries(next).catch(console.error);
    saveDraft(selectedDate, null);
    setLastSaved(now);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
    setTimeout(() => setLastSaved(null), 2000);
  };

  const remove = () => {
    if (!entryForDate) return;
    if (!confirm("이 날짜의 일기를 삭제할까요?")) return;
    const next = entries.filter((e) => e.date !== selectedDate);
    setEntries(next);
    setDraft("");
    setDraftImportant(false);
    deleteJournalEntry(selectedDate).catch(console.error);
  };

  const [year, month] = selectedDate.split("-").map(Number);
  const entriesByDate = Object.fromEntries(
    entries.map((e) => [e.date, e])
  ) as Record<string, JournalEntry>;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear - 2018 },
    (_, i) => 2020 + i
  );

  const setCalendarYear = (y: number) => {
    setSelectedDate(`${y}-${String(month).padStart(2, "0")}-01`);
  };

  const setCalendarMonth = (m: number) => {
    setSelectedDate(`${year}-${String(m).padStart(2, "0")}-01`);
  };

  const goPrevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const goNextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr()) return;
    setSelectedDate(next);
  };

  /** 볼드: 선택 영역을 ** 로 감싸기 (또는 커서 위치에 ** 삽입) */
  const insertBold = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = draft.slice(0, start);
    const selected = draft.slice(start, end);
    const after = draft.slice(end);
    if (selected) {
      setDraft(`${before}**${selected}**${after}`);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 2, end + 2);
      }, 0);
    } else {
      setDraft(`${before}****${after}`);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement?.tagName ?? "";
      const inInput = target === "TEXTAREA" || target === "INPUT";
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevDay();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight") {
        e.preventDefault();
        goNextDay();
        return;
      }
      if (!inInput && (e.key === "j" || e.key === "k")) {
        e.preventDefault();
        if (e.key === "j") goPrevDay();
        else goNextDay();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        insertBold();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDate, draft]);

  const entryDates = new Set(entries.map((e) => e.date));
  const streak = (() => {
    let count = 0;
    let d = new Date();
    const today = todayStr();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (key > today) break;
      if (entryDates.has(key)) count++;
      else if (key !== today) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  const [searchQuery, setSearchQuery] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState(todayStr().slice(0, 7) + "-01");
  const [exportTo, setExportTo] = useState(todayStr());
  const searchQueryNorm = searchQuery.trim().toLowerCase();
  const searchResults = searchQueryNorm
    ? entries
        .filter((e) => e.content.toLowerCase().includes(searchQueryNorm))
        .map((e) => e.date)
        .sort()
        .reverse()
    : [];

  const exportCount = entries.filter(
    (e) => e.date >= exportFrom && e.date <= exportTo
  ).length;

  const exportRange = (from: string, to: string) => {
    const list = entries.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    const text = list
      .map((e) => `## ${formatDateLabel(e.date)}${e.important ? " ★" : ""}\n\n${e.content}\n\n`)
      .join("---\n\n");
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `일기_${from}_${to}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const datesWithEntries = entryDates;
  const lastDay = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=일
  const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const totalCells = 42;
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDayOfWeek || i >= firstDayOfWeek + lastDay) {
      calendarCells.push(null);
    } else {
      calendarCells.push(i - firstDayOfWeek + 1);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* 저장 토스트 */}
      {saveToast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-semibold text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          저장됨 ✓
        </div>
      )}

      <SectionTitle
        title="일기장"
        subtitle="하루를 돌아보고, 차분하게 감정을 정리해요."
      />
      {journalLoading && (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="relative flex min-w-0 flex-col">
          {/* 중요한 날: 우측 상단 별표 (크게, 비활성도 꽉 찬 별) */}
          <button
            type="button"
            onClick={() => setDraftImportant(!draftImportant)}
            className={clsx(
              "absolute right-6 top-6 p-1 text-3xl transition",
              draftImportant ? "text-orange-500" : "text-neutral-200 hover:text-orange-400"
            )}
            title="중요한 날"
            aria-label={draftImportant ? "중요한 날 해제" : "중요한 날로 표시"}
          >
            ★
          </button>
          {/* 날짜 표시 (PC·모바일 공통) + 좌우 이동 (PC는 상단, 모바일은 저장 옆) */}
          <div className="mb-6 flex flex-wrap items-center gap-1 pr-10">
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={goPrevDay}
                aria-label="어제"
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNextDay}
                disabled={selectedDate >= todayStr()}
                aria-label="다음날"
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <span className="text-lg font-semibold text-neutral-800">
              {formatDateLabel(selectedDate)}
            </span>
            {isToday ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                오늘
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr())}
                className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800"
              >
                오늘로 이동
              </button>
            )}
          </div>
          {/* 초안 자동 저장 상태 */}
          <p className="mb-1 text-xs text-neutral-500">
            {draftSaveStatus === "pending" && "2초 후 초안 자동 저장"}
            {draftSaveStatus === "saved" && "초안 자동 저장됨"}
            {draftSaveStatus === "idle" &&
              draft.trim() !== currentContent &&
              "저장 버튼을 눌러 일기에 반영하세요"}
          </p>

          {/* 미리보기(눈) / 쓰기(연필) 탭 (볼드는 Ctrl+B) */}
          <div className="mb-2 flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              title="미리보기"
              aria-label="미리보기"
              className={clsx(
                "rounded-md p-2 text-sm font-medium transition",
                viewMode === "preview"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-800"
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("write")}
              title="쓰기"
              aria-label="쓰기"
              className={clsx(
                "rounded-md p-2 text-sm font-medium transition",
                viewMode === "write"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-800"
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>

          {/* 본문 (Ctrl+Enter / Cmd+Enter로 저장, Ctrl+B 볼드) */}
          {viewMode === "write" ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              placeholder="오늘 하루를 적어보세요. **볼드**는 미리보기에서 보여요."
              className="min-h-[420px] w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 text-[18px] leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
              rows={16}
            />
          ) : (
            <div className="min-h-[420px] w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 text-[18px] leading-relaxed text-neutral-800">
              {draft.trim() ? (
                <div
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(draft) }}
                />
              ) : (
                <p className="text-neutral-400">내용이 없어요.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* 모바일 전용: 이전/다음 날 버튼을 저장 옆에 */}
            <div className="flex md:hidden items-center gap-1">
              <button
                type="button"
                onClick={goPrevDay}
                aria-label="이전 날"
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNextDay}
                disabled={selectedDate >= todayStr()}
                aria-label="다음 날"
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <span className="relative inline-block">
              <button
                type="button"
                onClick={save}
                className="peer rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
              >
                {lastSaved ? "저장됨" : "저장"}
              </button>
              <span
                className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs text-white opacity-0 transition-[opacity,visibility] duration-75 peer-hover:visible peer-hover:opacity-100"
                role="tooltip"
              >
                저장 (Ctrl+Enter / ⌘+Enter)
              </span>
            </span>
            {entryForDate && (
              <button
                type="button"
                onClick={remove}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                삭제
              </button>
            )}
          </div>
        </Card>

        {/* 오른쪽: 연속 작성 + 검색 + 달력 + 내보내기 */}
        <div className="flex flex-col gap-4">
        {/* 연속 작성 (불 아이콘) - 검색 위 */}
        {streak > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-neutral-500">
            <span aria-hidden>🔥</span>
            연속 <span className="font-semibold text-neutral-700">{streak}</span>일 작성 중
          </p>
        )}
        {/* 검색 - 달력 위, 정렬 맞춤 */}
        <div className="space-y-2">
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-0 flex h-full w-9 items-center justify-center text-neutral-400" aria-hidden>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="일기에서 단어 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1">
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {(showAllSearchResults ? searchResults : searchResults.slice(0, 6)).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                  >
                    {d}
                  </button>
                ))}
              </div>
              {searchResults.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllSearchResults((v) => !v)}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
                >
                  {showAllSearchResults ? "접기" : `더 보기 (+${searchResults.length - 6})`}
                </button>
              )}
            </div>
          )}
        </div>
        <Card className="h-fit !p-5 !pb-2 md:!p-5 md:!pb-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <select
              value={year}
              onChange={(e) => setCalendarYear(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium text-neutral-800"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setCalendarMonth(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium text-neutral-800"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-neutral-400 sm:gap-2 sm:text-xs">
              {weekLabels.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-1.5 sm:gap-2">
              {calendarCells.map((day, i) => {
                if (day === null) {
                  return <div key={i} className="aspect-square" />;
                }
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const entry = entriesByDate[dateStr];
                const hasEntry = !!entry;
                const hasDraftForThisDate = dateStr === selectedDate && draft.trim().length > 0;
                const showTooltip = hasEntry || hasDraftForThisDate;
                const tooltipText = hasEntry
                  ? firstLinePreview(entry!.content, 80)
                  : firstLinePreview(draft, 80);
                const isImportant = entry?.important ?? false;
                const isSelected = dateStr === selectedDate;
                const dimmed = showOnlyImportant && (!hasEntry || !isImportant);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    onMouseEnter={(e) => {
                      if (!showTooltip || !tooltipText.trim()) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setCellTooltip({
                        dateStr,
                        text: tooltipText,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setCellTooltip(null)}
                    className={clsx(
                      "relative aspect-square rounded-md text-sm transition sm:text-base",
                      dimmed && "opacity-40",
                      isSelected
                        ? "bg-neutral-800 font-semibold text-white"
                        : isImportant
                          ? "bg-orange-200 font-medium text-orange-900 hover:bg-orange-300"
                          : hasEntry
                            ? "bg-neutral-200 font-medium text-neutral-800 hover:bg-neutral-300"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowOnlyImportant((v) => !v)}
              className={clsx(
                "rounded-full p-2 text-2xl transition",
                showOnlyImportant
                  ? "text-orange-500"
                  : "text-neutral-300 hover:text-orange-400"
              )}
              title="중요한 날만 강조"
              aria-label={showOnlyImportant ? "강조 해제" : "중요한 날만 강조"}
            >
              ★
            </button>
          </div>
          {cellTooltip &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full rounded-lg bg-neutral-800 px-4 py-2.5 text-base text-white shadow-lg"
                style={{
                  left: cellTooltip.x,
                  top: cellTooltip.y - 8,
                  maxWidth: "min(320px, 90vw)",
                }}
              >
                {cellTooltip.text}
              </div>,
              document.body
            )}
        </Card>

        {/* 달력 아래: 내보내기 */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowExport(!showExport)}
            className="w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            내보내기
          </button>
          {showExport && (
            <Card className="!p-4">
              <p className="mb-3 text-sm font-medium text-neutral-700">기간 선택 후 다운로드 (마크다운)</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                />
                <span className="text-neutral-400">~</span>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => exportRange(exportFrom, exportTo)}
                  className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  다운로드
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {exportFrom} ~ {exportTo}: <strong>{exportCount}편</strong>
              </p>
            </Card>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
