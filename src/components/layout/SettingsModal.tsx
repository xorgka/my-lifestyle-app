"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import { loadJournalEntries } from "@/lib/journal";
import {
  loadEntries,
  loadKeywords,
  loadMonthExtras,
  getCategoryForEntry,
  getKeywordsForMonth,
  toYearMonth,
  CATEGORY_LABELS,
  type BudgetEntry,
} from "@/lib/budget";
import { loadYoutubeChannels } from "@/lib/youtubeDb";
import { todayStr } from "@/lib/dateUtil";
import { loadIncomeEntries, type IncomeEntry } from "@/lib/income";

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${week})`;
}

function formatted(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

async function exportJournal(from: string, to: string): Promise<{ blob: Blob; filename: string }> {
  const entries = await loadJournalEntries();
  const filtered = entries.filter((e) => e.date >= from && e.date <= to);
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  const text = sorted
    .map((e) => `## ${formatDateLabel(e.date)}${e.important ? " ★" : ""}\n\n${e.content}\n\n`)
    .join("---\n\n");
  const suffix = from === to ? from : `${from}_${to}`;
  return { blob: new Blob([text], { type: "text/markdown;charset=utf-8" }), filename: `일기장_${suffix}.md` };
}

async function exportYoutube(from: string, to: string): Promise<{ blob: Blob; filename: string }> {
  const channels = await loadYoutubeChannels();
  const monthlyAggregate: Record<string, number> = {};
  const fromYm = from.slice(0, 7);
  const toYm = to.slice(0, 7);
  channels.forEach((c) => {
    Object.entries(c.monthlyRevenues || {}).forEach(([k, v]) => {
      if (k >= fromYm && k <= toYm) {
        monthlyAggregate[k] = (monthlyAggregate[k] ?? 0) + v;
      }
    });
  });
  const years = [...new Set(Object.keys(monthlyAggregate).map((k) => k.slice(0, 4)))].sort();
  const wb = XLSX.utils.book_new();
  for (const y of years) {
    const yearTotal = Object.entries(monthlyAggregate)
      .filter(([k]) => k.startsWith(String(y)))
      .reduce((a, [, v]) => a + v, 0);
    const rows: (string | number)[][] = [
      ["월", "수익(원)"],
      ...Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const yyyyMm = `${y}-${String(m).padStart(2, "0")}`;
        return [`${m}월`, formatted(monthlyAggregate[yyyyMm] ?? 0)];
      }),
      ["연 전체", formatted(yearTotal)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `${y}년`);
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const suffix = from === to ? from.slice(0, 7) : `${from.slice(0, 7)}_${to.slice(0, 7)}`;
  return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename: `채널수익_${suffix}.xlsx` };
}

async function exportBudget(from: string, to: string): Promise<{ blob: Blob; filename: string }> {
  const [entries, keywords, monthExtras] = await Promise.all([loadEntries(), loadKeywords(), loadMonthExtras()]);
  const filtered = entries.filter((e) => e.date >= from && e.date <= to);
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  const rows: (string | number)[][] = [
    ["날짜", "항목", "구분", "금액"],
    ...sorted.map((e: BudgetEntry) => {
      const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
      const cat = getCategoryForEntry(e.item, kw);
      return [e.date, e.item, CATEGORY_LABELS[cat], e.amount];
    }),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "가계부");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const filename = from.slice(0, 4) === to.slice(0, 4) && from.slice(0, 7) === to.slice(0, 7)
    ? `가계부_${from.slice(0, 7)}.xlsx`
    : `가계부_${from}_${to}.xlsx`;
  return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename };
}

function incomeInRange(e: IncomeEntry, from: string, to: string): boolean {
  const y = e.year;
  const m = String(e.month).padStart(2, "0");
  const ym = `${y}-${m}`;
  const fromYm = from.slice(0, 7);
  const toYm = to.slice(0, 7);
  return ym >= fromYm && ym <= toYm;
}

async function exportIncome(from: string, to: string): Promise<{ blob: Blob; filename: string }> {
  const incomeEntries = loadIncomeEntries();
  const filtered = incomeEntries.filter((e) => incomeInRange(e, from, to));
  const sorted = [...filtered].sort((a, b) => a.year - b.year || a.month - b.month);
  const rows: (string | number)[][] = [["연도", "월", "구분", "항목", "금액"]];
  if (sorted.length > 0) {
    const yearSet = [...new Set(sorted.map((e) => e.year))].sort((a, b) => a - b);
    for (const y of yearSet) {
      for (let m = 1; m <= 12; m++) {
        const monthEntries = sorted.filter((e: IncomeEntry) => e.year === y && e.month === m);
        if (monthEntries.length === 0) continue;
        rows.push([`${y}년 ${m}월`, "", "", "", ""]);
        monthEntries.forEach((e) => rows.push([e.year, e.month, e.category, e.item, e.amount]));
      }
    }
  } else {
    sorted.forEach((e) => rows.push([e.year, e.month, e.category, e.item, e.amount]));
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "수입내역");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const filename = from.slice(0, 7) === to.slice(0, 7) ? `수입내역_${from.slice(0, 7)}.xlsx` : `수입내역_${from}_${to}.xlsx`;
  return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { onClose: () => void };

export function SettingsModal({ onClose }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultFrom = (() => {
    const d = new Date(currentYear - 1, now.getMonth(), now.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  type RangeType = "month" | "year" | "range" | "all";
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeType, setRangeType] = useState<RangeType>("range");
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [rangeFrom, setRangeFrom] = useState(defaultFrom);
  const [rangeTo, setRangeTo] = useState(defaultTo);

  function getFromTo(): [string, string] {
    if (rangeType === "month") {
      const y = exportYear;
      const m = String(exportMonth).padStart(2, "0");
      const lastDay = new Date(y, exportMonth, 0).getDate();
      return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, "0")}`];
    }
    if (rangeType === "year") {
      return [`${exportYear}-01-01`, `${exportYear}-12-31`];
    }
    if (rangeType === "range") {
      return [rangeFrom, rangeTo];
    }
    return ["2000-01-01", "2030-12-31"];
  }

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const runExport = async (type: "journal" | "youtube" | "budget" | "income") => {
    setError(null);
    setExporting(type);
    const [from, to] = getFromTo();
    try {
      if (type === "journal") {
        const { blob, filename } = await exportJournal(from, to);
        downloadBlob(blob, filename);
      } else if (type === "youtube") {
        const { blob, filename } = await exportYoutube(from, to);
        downloadBlob(blob, filename);
      } else if (type === "budget") {
        const { blob, filename } = await exportBudget(from, to);
        downloadBlob(blob, filename);
      } else {
        const { blob, filename } = await exportIncome(from, to);
        downloadBlob(blob, filename);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내기 실패");
    } finally {
      setExporting(null);
    }
  };

  const runExportAll = async () => {
    setError(null);
    setExporting("all");
    const [from, to] = getFromTo();
    try {
      const zip = new JSZip();
      const [journal, youtube, budget, income] = await Promise.all([
        exportJournal(from, to),
        exportYoutube(from, to),
        exportBudget(from, to),
        exportIncome(from, to),
      ]);
      zip.file(journal.filename, journal.blob);
      zip.file(youtube.filename, youtube.blob);
      zip.file(budget.filename, budget.blob);
      zip.file(income.filename, income.blob);
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `MyLifestyle_전체내보내기_${todayStr()}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "전체 내보내기 실패");
    } finally {
      setExporting(null);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="fixed inset-0 h-[100dvh] w-[100vw] min-h-full min-w-full bg-black/55"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h2 id="settings-modal-title" className="text-xl font-bold text-neutral-900">
            설정
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <section className="pb-6">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">계정</h3>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 w-full rounded-xl border border-neutral-200 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              로그아웃
            </button>
          </section>

          <section className="border-t border-neutral-200 pt-6">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">내보내기</h3>
            <p className="mt-1 text-sm text-neutral-500">
              연도와 범위를 선택한 뒤 내보내기를 누르세요.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500">연도</label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-xs font-medium text-neutral-500">내보내기 범위</span>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={rangeType === "month"}
                      onChange={() => setRangeType("month")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">특정 월</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={rangeType === "year"}
                      onChange={() => setRangeType("year")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">특정 연도</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={rangeType === "range"}
                      onChange={() => setRangeType("range")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">특정 기간</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={rangeType === "all"}
                      onChange={() => setRangeType("all")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">전부</span>
                  </label>
                </div>
              </div>
              {rangeType === "month" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-500">월</label>
                  <select
                    value={exportMonth}
                    onChange={(e) => setExportMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
              )}
              {rangeType === "range" && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500">시작일 ~ 종료일</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                    <span className="text-neutral-400">~</span>
                    <input
                      type="date"
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                  </div>
                </div>
              )}
              {rangeType === "all" && (
                <p className="text-sm text-neutral-600">저장된 전체 데이터를 내보냅니다.</p>
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => runExport("journal")}
                disabled={!!exporting}
                className="rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {exporting === "journal" ? "내보내는 중…" : "일기장"}
              </button>
              <button
                type="button"
                onClick={() => runExport("youtube")}
                disabled={!!exporting}
                className="rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {exporting === "youtube" ? "내보내는 중…" : "유튜브"}
              </button>
              <button
                type="button"
                onClick={() => runExport("budget")}
                disabled={!!exporting}
                className="rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {exporting === "budget" ? "내보내는 중…" : "가계부"}
              </button>
              <button
                type="button"
                onClick={() => runExport("income")}
                disabled={!!exporting}
                className="rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {exporting === "income" ? "내보내는 중…" : "수입"}
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={runExportAll}
                disabled={!!exporting}
                className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {exporting === "all" ? "압축 중…" : "전체 한 번에 (ZIP)"}
              </button>
            </div>
          </section>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
