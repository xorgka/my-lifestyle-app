"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  loadCustomAlerts,
  saveCustomAlerts,
  loadSystemOverrides,
  saveSystemOverrides,
  SYSTEM_ALERT_DEFINITIONS,
  SYSTEM_ALERT_CATEGORIES,
  generateCustomAlertId,
  type CustomAlertItem,
  type SystemAlertOverride,
  type TimePreset,
  type SystemAlertCategoryId,
} from "@/lib/alertBarSettings";
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
import {
  getAllPopupIds,
  getPopupConfig,
  savePopupConfig,
  addCustomPopup,
  removeCustomPopup,
  SYSTEM_POPUP_LABELS,
  SYSTEM_POPUP_IDS,
  type PopupConfig,
  type PopupBenefitItem,
} from "@/lib/popupReminderConfig";
import {
  getInsightBgSettings,
  setInsightBgSettings,
  type InsightBgMode,
  type InsightBgSettings,
} from "@/lib/insightBg";
import { getWeatherBgSettings, setWeatherBgSettings, type WeatherBgSettings } from "@/lib/weatherBg";
import type { WeatherThemeId } from "@/lib/weather";

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
  const incomeEntries = await loadIncomeEntries();
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

type SettingsTab = "export" | "alertbar" | "popup" | "background" | "shortcuts" | "account";

export function SettingsModal({ onClose }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultFrom = (() => {
    const d = new Date(currentYear - 1, now.getMonth(), now.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const [activeTab, setActiveTab] = useState<SettingsTab>("export");
  const [systemAlertCategory, setSystemAlertCategory] = useState<SystemAlertCategoryId>("sleep");
  const [systemOverrides, setSystemOverrides] = useState<Record<string, SystemAlertOverride>>({});
  const [customAlerts, setCustomAlerts] = useState<CustomAlertItem[]>([]);

  // 팝업 탭: 편집/추가 폼 상태
  const [popupListVersion, setPopupListVersion] = useState(0);
  const [editingPopupId, setEditingPopupId] = useState<string | null>(null);
  const [addingNewPopup, setAddingNewPopup] = useState(false);
  const [popupDraft, setPopupDraft] = useState<Partial<PopupConfig> | null>(null);

  // 배경 탭: 투데이 인사이트 + 날씨 박스
  const [bgSettingSubTab, setBgSettingSubTab] = useState<"insight" | "weather">("insight");
  const [insightBgMode, setInsightBgMode] = useState<InsightBgMode>("auto");
  const [insightBgSingleUrl, setInsightBgSingleUrl] = useState("");
  const [insightBgListUrls, setInsightBgListUrls] = useState<string[]>([""]);
  const [insightBgSaved, setInsightBgSaved] = useState(false);
  const [weatherBgUrls, setWeatherBgUrls] = useState<Record<WeatherThemeId, string[]>>(() => ({
    clear: [], partlyCloudy: [], fog: [], rain: [], snow: [], showers: [], thunderstorm: [], overcast: [],
  }));
  const [weatherBgSaved, setWeatherBgSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "alertbar") {
      setSystemOverrides(loadSystemOverrides());
      setCustomAlerts(loadCustomAlerts());
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "background") {
      const s = getInsightBgSettings();
      setInsightBgMode(s.mode);
      if (s.mode === "single") setInsightBgSingleUrl(s.url ?? "");
      if (s.mode === "list") setInsightBgListUrls(s.urls.length > 0 ? s.urls : [""]);
      const w = getWeatherBgSettings();
      const themeIds: WeatherThemeId[] = ["clear", "partlyCloudy", "fog", "rain", "snow", "showers", "thunderstorm", "overcast"];
      setWeatherBgUrls((prev) => {
        const next = { ...prev };
        for (const id of themeIds) next[id] = w[id] ?? [];
        return next;
      });
    }
  }, [activeTab]);

  const updateSystemOverride = (key: string, patch: Partial<SystemAlertOverride>) => {
    const next = { ...systemOverrides, [key]: { ...systemOverrides[key], ...patch } };
    setSystemOverrides(next);
    saveSystemOverrides(next);
  };

  const addCustomAlert = () => {
    const item: CustomAlertItem = { id: generateCustomAlertId(), text: "", href: "/", timePreset: "always" };
    const next = [...customAlerts, item];
    setCustomAlerts(next);
    saveCustomAlerts(next);
  };

  const updateCustomAlert = (id: string, patch: Partial<CustomAlertItem>) => {
    const next = customAlerts.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setCustomAlerts(next);
    saveCustomAlerts(next);
  };

  const removeCustomAlert = (id: string) => {
    const next = customAlerts.filter((c) => c.id !== id);
    setCustomAlerts(next);
    saveCustomAlerts(next);
  };

  type RangeType = "month" | "year" | "range" | "all";
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeType, setRangeType] = useState<RangeType>("range");
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [rangeFrom, setRangeFrom] = useState(defaultFrom);
  const [rangeTo, setRangeTo] = useState(defaultTo);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "export", label: "내보내기" },
    { id: "alertbar", label: "알림바" },
    { id: "popup", label: "팝업" },
    { id: "background", label: "배경" },
    { id: "shortcuts", label: "단축키" },
    { id: "account", label: "계정" },
  ];

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

  const renderMainContent = () => {
    if (activeTab === "shortcuts") {
      const shortcutSections = [
        {
          title: "전역",
          items: [
            { keys: "Home", desc: "홈(/)으로 이동" },
            { keys: ". (마침표)", desc: "수면관리로 이동" },
            { keys: "0", desc: "타임테이블로 이동" },
            { keys: "1", desc: "재생 / 일시정지" },
            { keys: "2", desc: "다음 곡" },
            { keys: "Ctrl + Shift + M", desc: "노트 페이지로 이동", mac: "Mac: Cmd + Shift + M" },
          ],
        },
        {
          title: "일기장",
          items: [
            { keys: "Ctrl + S", desc: "저장", mac: "Mac: Cmd + S" },
            { keys: "Ctrl + ← / →", desc: "이전 / 다음 날짜", mac: "Mac: Cmd + ← / →" },
            { keys: "A / D", desc: "이전 / 다음 날짜 (입력창 아닐 때)" },
            { keys: "Ctrl + B", desc: "굵게", mac: "Mac: Cmd + B" },
          ],
        },
        {
          title: "노트(메모) 에디터",
          items: [
            { keys: "Ctrl + Shift + H", desc: "형광펜" },
            { keys: "Ctrl + Shift + -", desc: "구분선 삽입" },
            { keys: "- + 스페이스", desc: "해당 줄을 글머리 기호(목록)로" },
          ],
        },
      ];
      return (
        <section className="space-y-6">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">키보드 단축키</h3>
          <p className="text-sm text-neutral-500">입력창·에디터에 포커스가 있을 때는 일부 단축키가 동작하지 않아요.</p>
          {shortcutSections.map((sec) => (
            <div key={sec.title}>
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{sec.title}</h4>
              <ul className="mt-2 space-y-2">
                {sec.items.map((item) => (
                  <li key={item.keys} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50/50 px-3 py-2.5">
                    <span className="text-sm text-neutral-800">{item.desc}</span>
                    <span className="shrink-0 font-mono text-xs font-medium text-neutral-600">
                      {item.keys}
                      {item.mac != null && <span className="ml-1 text-neutral-400">({item.mac})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      );
    }
    if (activeTab === "background") {
      return (
        <section className="space-y-8">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">배경</h3>
          <div className="flex shrink-0 gap-2 border-b border-neutral-200 pb-3">
            <button
              type="button"
              onClick={() => setBgSettingSubTab("insight")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${bgSettingSubTab === "insight" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
            >
              투데이 인사이트 배경
            </button>
            <button
              type="button"
              onClick={() => setBgSettingSubTab("weather")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${bgSettingSubTab === "weather" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
            >
              날씨 박스 배경
            </button>
          </div>
          {bgSettingSubTab === "insight" && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500">
                홈 카드 배경을 자동(Picsum), 한 장 고정, 또는 내 URL 목록 순환 중에서 선택할 수 있어요.
              </p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="insightBgModeSettings"
                    checked={insightBgMode === "auto"}
                    onChange={() => setInsightBgMode("auto")}
                    className="h-4 w-4 border-neutral-300 text-neutral-700"
                  />
                  <span className="text-sm text-neutral-700">자동 (Picsum, 12시간마다 바뀜)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="insightBgModeSettings"
                    checked={insightBgMode === "single"}
                    onChange={() => setInsightBgMode("single")}
                    className="h-4 w-4 border-neutral-300 text-neutral-700"
                  />
                  <span className="text-sm text-neutral-700">한 장 고정 (URL 1개)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="insightBgModeSettings"
                    checked={insightBgMode === "list"}
                    onChange={() => setInsightBgMode("list")}
                    className="h-4 w-4 border-neutral-300 text-neutral-700"
                  />
                  <span className="text-sm text-neutral-700">내 URL 목록 순환 (12시간마다)</span>
                </label>
              </div>
              {insightBgMode === "single" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    value={insightBgSingleUrl}
                    onChange={(e) => setInsightBgSingleUrl(e.target.value)}
                    placeholder="https://..."
                    className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50 md:min-w-[16rem]"
                  />
                  <button
                    type="button"
                    onClick={() => insightBgSingleUrl.trim() && window.open(insightBgSingleUrl.trim(), "_blank", "noopener,noreferrer")}
                    disabled={!insightBgSingleUrl.trim()}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
                    title="새 탭에서 열기"
                  >
                    URL 열기
                  </button>
                </div>
              )}
              {insightBgMode === "list" && (
                <div className="space-y-2">
                  {insightBgListUrls.map((url, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const next = [...insightBgListUrls];
                          next[i] = e.target.value;
                          setInsightBgListUrls(next);
                        }}
                        placeholder="https://..."
                        className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50 md:min-w-[14rem]"
                      />
                      <button
                        type="button"
                        onClick={() => url.trim() && window.open(url.trim(), "_blank", "noopener,noreferrer")}
                        disabled={!url.trim()}
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
                        title="새 탭에서 열기"
                      >
                        URL 열기
                      </button>
                      <button
                        type="button"
                        onClick={() => setInsightBgListUrls(insightBgListUrls.filter((_, j) => j !== i))}
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
                        aria-label="삭제"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setInsightBgListUrls([...insightBgListUrls, ""])}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    + URL 추가
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const settings: InsightBgSettings =
                      insightBgMode === "auto"
                        ? { mode: "auto" }
                        : insightBgMode === "single"
                          ? { mode: "single", url: insightBgSingleUrl.trim() }
                          : {
                              mode: "list",
                              urls: insightBgListUrls.map((u) => u.trim()).filter(Boolean),
                            };
                    if (settings.mode === "list" && settings.urls.length === 0) return;
                    setInsightBgSettings(settings);
                    setInsightBgSaved(true);
                    setTimeout(() => setInsightBgSaved(false), 2000);
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  저장
                </button>
                {insightBgMode !== "auto" && (
                  <button
                    type="button"
                    onClick={() => {
                      setInsightBgSettings({ mode: "auto" });
                      setInsightBgMode("auto");
                      setInsightBgSaved(true);
                      setTimeout(() => setInsightBgSaved(false), 2000);
                    }}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    자동으로 되돌리기
                  </button>
                )}
              </div>
              {insightBgSaved && (
                <p className="text-xs text-green-600">적용되었어요. 홈에서 확인해 보세요.</p>
              )}
            </div>
          )}
          {bgSettingSubTab === "weather" && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500">
                날씨별로 이미지 URL을 여러 장씩 등록할 수 있어요. 해당 날씨일 때 그중 한 장이 랜덤으로 배경에 표시돼요.
              </p>
              <div className="space-y-4 pr-1">
                {(
                  [
                    ["clear", "맑음"],
                    ["partlyCloudy", "구름 조금"],
                    ["fog", "안개"],
                    ["rain", "비"],
                    ["snow", "눈"],
                    ["showers", "소나기"],
                    ["thunderstorm", "천둥·번개"],
                    ["overcast", "흐림"],
                  ] as const
                ).map(([themeId, label]) => (
                  <div key={themeId} className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                    <p className="text-sm font-medium text-neutral-700">{label}</p>
                    {(weatherBgUrls[themeId] ?? []).map((url, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            const next = [...(weatherBgUrls[themeId] ?? [])];
                            next[i] = e.target.value;
                            setWeatherBgUrls((u) => ({ ...u, [themeId]: next }));
                          }}
                          placeholder="https://..."
                          className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm md:min-w-[12rem]"
                        />
                        <button
                          type="button"
                          onClick={() => url.trim() && window.open(url.trim(), "_blank", "noopener,noreferrer")}
                          disabled={!url.trim()}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
                          title="새 탭에서 열기"
                        >
                          URL 열기
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setWeatherBgUrls((u) => ({
                              ...u,
                              [themeId]: (u[themeId] ?? []).filter((_, j) => j !== i),
                            }))
                          }
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setWeatherBgUrls((u) => ({
                          ...u,
                          [themeId]: [...(u[themeId] ?? []), ""],
                        }))
                      }
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      + URL 추가
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const settings: WeatherBgSettings = {};
                    (Object.keys(weatherBgUrls) as WeatherThemeId[]).forEach((id) => {
                      const urls = (weatherBgUrls[id] ?? []).map((u) => u.trim()).filter(Boolean);
                      if (urls.length > 0) settings[id] = urls;
                    });
                    setWeatherBgSettings(settings);
                    if (typeof window !== "undefined") {
                      (window as unknown as { __WEATHER_BG_SAVED?: number }).__WEATHER_BG_SAVED = Date.now();
                      window.dispatchEvent(new CustomEvent("weather-bg-settings-changed"));
                    }
                    setWeatherBgSaved(true);
                    setTimeout(() => setWeatherBgSaved(false), 2000);
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  저장
                </button>
                {weatherBgSaved && <p className="text-xs text-green-600">적용되었어요. 홈에서 확인해 보세요.</p>}
              </div>
            </div>
          )}
        </section>
      );
    }
    if (activeTab === "account") {
      const accountItems = [
        { title: "My Lifestyle", content: "xorgka25@naver.com" },
        { title: "Vercel", content: "kailysoodal@gmail.com" },
        { title: "Supabase", content: "kailysoodal@gmail.com" },
        { title: "Cursor AI", content: "kailysoodal@gmail.com" },
      ];
      return (
        <section>
          <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">계정</h3>
          <ul className="mt-3 space-y-3">
            {accountItems.map((item) => (
              <li key={item.title} className="rounded-xl border border-neutral-100 bg-neutral-50/50 px-4 py-3">
                <p className="text-xs font-medium text-neutral-500">{item.title}</p>
                <p className="mt-0.5 text-sm text-neutral-800">{item.content}</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 rounded-xl border border-neutral-200 py-3 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            로그아웃
          </button>
        </section>
      );
    }
    if (activeTab === "alertbar") {
      return (
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">시스템 알림</h3>
            <p className="mt-1 text-sm text-neutral-500">표시를 끄거나 문구를 바꿀 수 있어요. 문구를 비우면 기본 문구가 나와요. 일부 문구는 데이터에 따라 일부가 자동으로 채워져요.</p>
            <div className="mt-3 flex flex-wrap gap-1 border-b border-neutral-200 pb-2">
              {SYSTEM_ALERT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSystemAlertCategory(cat.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    systemAlertCategory === cat.id
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-neutral-100 bg-neutral-50/50 p-2">
              {SYSTEM_ALERT_DEFINITIONS.filter((def) => {
                const cat = SYSTEM_ALERT_CATEGORIES.find((c) => c.id === systemAlertCategory);
                return cat?.keys.includes(def.key);
              }).map((def) => {
                const ov = systemOverrides[def.key];
                const disabled = ov?.disabled ?? false;
                const customText = ov?.customText ?? "";
                return (
                  <li key={def.key} className="flex flex-col gap-1.5 rounded-lg bg-white p-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!disabled}
                          onChange={(e) => updateSystemOverride(def.key, { disabled: !e.target.checked })}
                          className="rounded border-neutral-300 text-neutral-700"
                        />
                        <span className="text-xs font-medium text-neutral-600">표시</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => updateSystemOverride(def.key, { customText: e.target.value })}
                      placeholder={def.defaultLabel}
                      className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                    />
                    {def.variableHint && (
                      <p className="text-xs text-neutral-400">{def.variableHint}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">추가 문구</h3>
            <p className="mt-1 text-sm text-neutral-500">원하는 문구를 추가해 보세요. 연결할 링크가 있으면 입력하면 탭 시 해당 경로로 이동해요. (비우면 홈)</p>
            <ul className="mt-3 space-y-2">
              {customAlerts.map((item) => (
                <li key={item.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateCustomAlert(item.id, { text: e.target.value })}
                      placeholder="표시할 문구"
                      className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <span className="mr-1 text-xs text-neutral-500">링크</span>
                        <input
                          type="text"
                          value={item.href ?? ""}
                          onChange={(e) => updateCustomAlert(item.id, { href: e.target.value || undefined })}
                          placeholder="비우면 홈 (예: /routine)"
                          className="w-36 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-800 placeholder:text-neutral-400"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-neutral-500">노출 시간</span>
                        <label className="flex cursor-pointer items-center gap-1">
                          <input
                            type="radio"
                            name={`time-${item.id}`}
                            checked={(item.timePreset ?? "always") === "always"}
                            onChange={() =>
                              updateCustomAlert(item.id, { timePreset: "always", timeFrom: undefined, timeTo: undefined })
                            }
                            className="text-neutral-700"
                          />
                          <span className="text-xs">항상</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-1">
                          <input
                            type="radio"
                            name={`time-${item.id}`}
                            checked={(item.timePreset ?? "always") === "custom"}
                            onChange={() =>
                              updateCustomAlert(item.id, {
                                timePreset: "custom",
                                timeFrom: item.timeFrom ?? 22,
                                timeTo: item.timeTo ?? 5,
                              })
                            }
                            className="text-neutral-700"
                          />
                          <span className="text-xs">직접 설정</span>
                        </label>
                        {(item.timePreset ?? "always") === "custom" && (
                          <>
                            <input
                              type="number"
                              min={0}
                              max={23}
                              value={item.timeFrom ?? 22}
                              onChange={(e) =>
                                updateCustomAlert(item.id, { timeFrom: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) })
                              }
                              className="w-12 rounded border border-neutral-200 px-1.5 py-1 text-xs text-neutral-800"
                            />
                            <span className="text-xs text-neutral-400">시 ~</span>
                            <input
                              type="number"
                              min={0}
                              max={23}
                              value={item.timeTo ?? 5}
                              onChange={(e) =>
                                updateCustomAlert(item.id, { timeTo: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) })
                              }
                              className="w-12 rounded border border-neutral-200 px-1.5 py-1 text-xs text-neutral-800"
                            />
                            <span className="text-xs text-neutral-400">시</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomAlert(item.id)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addCustomAlert}
              className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              + 문구 추가
            </button>
          </section>
        </div>
      );
    }
    if (activeTab === "popup") {
      const popupIds = getAllPopupIds();
      const isSystemId = (id: string) => SYSTEM_POPUP_IDS.includes(id as typeof SYSTEM_POPUP_IDS[number]);

      const openEdit = (id: string) => {
        const c = getPopupConfig(id);
        if (c) {
          setEditingPopupId(id);
          setAddingNewPopup(false);
          setPopupDraft({ ...c });
        }
      };
      const openAdd = () => {
        setEditingPopupId(null);
        setAddingNewPopup(true);
        setPopupDraft({
          title: "",
          benefitsSubtitle: "",
          benefits: [],
          enabled: true,
          routineTitle: "",
          timeStart: 22,
          timeEnd: 3,
        });
      };
      const closePopupForm = () => {
        setEditingPopupId(null);
        setAddingNewPopup(false);
        setPopupDraft(null);
      };
      const savePopupEdit = () => {
        if (!editingPopupId || !popupDraft) return;
        savePopupConfig(editingPopupId, popupDraft);
        setPopupListVersion((v) => v + 1);
        closePopupForm();
      };
      const savePopupAdd = () => {
        if (!popupDraft || !popupDraft.title?.trim()) return;
        addCustomPopup({
          ...popupDraft,
          title: popupDraft.title.trim(),
          benefits: popupDraft.benefits ?? [],
          routineTitle: popupDraft.routineTitle ?? "",
          timeStart: popupDraft.timeStart ?? 22,
          timeEnd: popupDraft.timeEnd ?? 3,
        });
        setPopupListVersion((v) => v + 1);
        closePopupForm();
      };
      const removePopup = (id: string) => {
        if (!isSystemId(id)) removeCustomPopup(id);
        setPopupListVersion((v) => v + 1);
        if (editingPopupId === id) closePopupForm();
      };

      const updateDraft = (patch: Partial<PopupConfig>) => {
        setPopupDraft((d) => (d ? { ...d, ...patch } : null));
      };
      const updateBenefit = (index: number, patch: Partial<PopupBenefitItem>) => {
        if (!popupDraft?.benefits) return;
        const next = [...popupDraft.benefits];
        next[index] = { ...next[index], ...patch };
        updateDraft({ benefits: next });
      };
      const addBenefit = () => {
        updateDraft({ benefits: [...(popupDraft?.benefits ?? []), { text: "", bold: [] }] });
      };
      const removeBenefit = (index: number) => {
        const next = (popupDraft?.benefits ?? []).filter((_, i) => i !== index);
        updateDraft({ benefits: next });
      };

      const renderPopupForm = (isAdd: boolean) => {
        if (!popupDraft) return null;
        const customOnly = isAdd || !editingPopupId || !isSystemId(editingPopupId);
        return (
          <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
            <h4 className="text-sm font-semibold text-neutral-700">{isAdd ? "새 팝업 추가" : "팝업 편집"}</h4>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500">제목</label>
                <input
                  type="text"
                  value={popupDraft.title ?? ""}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  placeholder="예: 기상 후 샤워 하셨나요?"
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
                />
              </div>
              <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">부제 (선택)</label>
                    <input
                      type="text"
                      value={popupDraft.benefitsSubtitle ?? ""}
                      onChange={(e) => updateDraft({ benefitsSubtitle: e.target.value })}
                      placeholder="예: 지금 샤워를 하면,"
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-neutral-500">장점 문구 (체크 항목)</label>
                      <button type="button" onClick={addBenefit} className="text-xs text-neutral-600 hover:underline">
                        + 항목 추가
                      </button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {(popupDraft.benefits ?? []).map((b, i) => (
                        <li key={i} className="flex gap-2 rounded-lg border border-neutral-100 bg-white p-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <input
                              type="text"
                              value={b.text}
                              onChange={(e) => updateBenefit(i, { text: e.target.value })}
                              placeholder="문구"
                              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                            />
                            <input
                              type="text"
                              value={(b.bold ?? []).join(", ")}
                              onChange={(e) =>
                                updateBenefit(i, {
                                  bold: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                })
                              }
                              placeholder="굵게 표시할 단어 (쉼표 구분)"
                              className="w-full rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600 placeholder:text-neutral-400"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBenefit(i)}
                            className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-500">카드 배경색</label>
                  <input
                    type="text"
                    value={popupDraft.cardBgColor ?? ""}
                    onChange={(e) => updateDraft({ cardBgColor: e.target.value || undefined })}
                    placeholder="#ffffff 또는 비움"
                    className="mt-1 w-32 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500">글자색</label>
                  <input
                    type="text"
                    value={popupDraft.textColor ?? ""}
                    onChange={(e) => updateDraft({ textColor: e.target.value || undefined })}
                    placeholder="비우면 기본"
                    className="mt-1 w-32 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500">강조색</label>
                  <input
                    type="text"
                    value={popupDraft.accentColor ?? ""}
                    onChange={(e) => updateDraft({ accentColor: e.target.value || undefined })}
                    placeholder="비우면 기본"
                    className="mt-1 w-32 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={popupDraft.enabled !== false}
                  onChange={(e) => updateDraft({ enabled: e.target.checked })}
                  className="rounded border-neutral-300 text-neutral-700"
                />
                <span className="text-sm text-neutral-700">사용</span>
              </label>
              {customOnly && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">루틴 제목에 포함될 문자열</label>
                    <input
                      type="text"
                      value={popupDraft.routineTitle ?? ""}
                      onChange={(e) => updateDraft({ routineTitle: e.target.value })}
                      placeholder="루틴 항목 제목에 이 글자가 있으면 이 팝업 표시"
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">노출 시간</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={popupDraft.timeStart ?? 22}
                      onChange={(e) =>
                        updateDraft({ timeStart: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) })
                      }
                      className="w-14 rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-800"
                    />
                    <span className="text-xs text-neutral-400">시 ~</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={popupDraft.timeEnd ?? 3}
                      onChange={(e) =>
                        updateDraft({ timeEnd: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) })
                      }
                      className="w-14 rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-800"
                    />
                    <span className="text-xs text-neutral-400">시</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              {isAdd ? (
                <button
                  type="button"
                  onClick={savePopupAdd}
                  disabled={!popupDraft.title?.trim()}
                  className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  추가
                </button>
              ) : (
                <button
                  type="button"
                  onClick={savePopupEdit}
                  className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  저장
                </button>
              )}
              <button
                type="button"
                onClick={closePopupForm}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                취소
              </button>
            </div>
          </div>
        );
      };

      return (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">팝업</h3>
          <p className="text-sm text-neutral-500">
            알림 팝업의 문구, 체크 항목, 배경/글자색을 수정하거나 끌 수 있어요. 커스텀 팝업을 추가할 수도 있어요.
          </p>
          {addingNewPopup && renderPopupForm(true)}
          {editingPopupId && renderPopupForm(false)}
          <ul className="space-y-2" key={popupListVersion}>
            {popupIds.map((id) => {
              const config = getPopupConfig(id);
              const label =
                config?.title?.trim() ||
                (isSystemId(id) ? SYSTEM_POPUP_LABELS[id as typeof SYSTEM_POPUP_IDS[number]] : "커스텀 팝업");
              const enabled = config?.enabled !== false;
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-100 bg-white p-3 shadow-sm"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        savePopupConfig(id, { enabled: e.target.checked });
                        setPopupListVersion((v) => v + 1);
                      }}
                      className="rounded border-neutral-300 text-neutral-700"
                    />
                    <span className="text-sm font-medium text-neutral-800">{label}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openEdit(id)}
                    className="ml-auto rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    편집
                  </button>
                  {!isSystemId(id) && (
                    <button
                      type="button"
                      onClick={() => removePopup(id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            + 팝업 추가
          </button>
        </section>
      );
    }
    // export
    return (
      <section>
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
    );
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-10 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="fixed inset-0 h-[100dvh] w-[100vw] min-h-full min-w-full bg-black/65"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* PC: 왼쪽 탭 메뉴 (모바일에서 숨김) */}
        <nav className="hidden w-44 shrink-0 flex-col border-r border-neutral-100 bg-neutral-50/80 py-4 sm:flex">
          <div className="px-4 pb-3 font-semibold text-neutral-900">설정</div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-left text-sm transition ${
                activeTab === tab.id
                  ? "border-r-2 border-neutral-800 bg-white font-medium text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {/* 메인 영역 */}
        <div className="min-w-0 flex-1 flex flex-col p-6">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <span className="font-semibold text-neutral-900 sm:hidden">설정</span>
            <span className="hidden sm:inline" aria-hidden />
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
          {/* 모바일: 상단 가로 스크롤 탭 */}
          <div className="sm:hidden overflow-x-auto border-b border-neutral-100 -mx-6 px-6 scrollbar-hide">
            <div className="flex gap-2 py-3 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 min-h-0 flex-1">
            {renderMainContent()}
            {error && activeTab === "export" && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
