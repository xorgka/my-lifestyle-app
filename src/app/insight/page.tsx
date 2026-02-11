"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import {
  loadInsightEntries,
  loadInsightEntriesFromStorage,
  addInsightEntry,
  updateInsightEntry,
  deleteInsightEntry,
  type InsightEntry,
} from "@/lib/insightDb";
import { isSupabaseConfigured } from "@/lib/supabase";
import { RECOMMENDED_INSIGHTS } from "@/components/home/TodayInsightHero";
import { loadSystemInsights, saveSystemInsights, type QuoteEntry } from "@/lib/insights";
import {
  getInsightBgSettings,
  setInsightBgSettings,
  type InsightBgMode,
  type InsightBgSettings,
} from "@/lib/insightBg";
import {
  getWeatherBgSettings,
  setWeatherBgSettings,
  type WeatherBgSettings,
} from "@/lib/weatherBg";
import type { WeatherThemeId } from "@/lib/weather";

type InsightTab = "mine" | "system";

/** 기본 문장 탭 통합 목록: 내가 저장한 문장(user) + 시스템 기본(system) */
type UnifiedItem =
  | { type: "user"; id: string; text: string; author?: string; createdAt: string }
  | { type: "system"; index: number; quote: string; author: string };

function InsightPageContent() {
  const searchParams = useSearchParams();
  const [insightTab, setInsightTab] = useState<InsightTab>(() =>
    searchParams.get("tab") === "mine" ? "mine" : "system"
  );

  const [insights, setInsights] = useState<InsightEntry[]>([]);
  const [insightLoading, setInsightLoading] = useState(true);
  /** 마지막 로드가 Supabase에서 성공했으면 true, 폴백(로컬)이면 false */
  const [lastLoadFromSupabase, setLastLoadFromSupabase] = useState<boolean | null>(null);
  /** 동기화 실패 시 오류 메시지 (모바일 디버깅용) */
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);
  /** 기본 문장 탭 */
  const [systemList, setSystemList] = useState<QuoteEntry[]>([]);
  const [systemSearchQuery, setSystemSearchQuery] = useState("");
  const [systemFilterYear, setSystemFilterYear] = useState<number | "all">("all");
  const [systemFilterMonth, setSystemFilterMonth] = useState<number | "all">("all");
  const [systemPage, setSystemPage] = useState(1);
  const [systemViewer, setSystemViewer] = useState<{ list: UnifiedItem[]; index: number } | null>(null);
  const [systemIsAdding, setSystemIsAdding] = useState(false);
  const [systemEditQuote, setSystemEditQuote] = useState("");
  const [systemEditAuthor, setSystemEditAuthor] = useState("");
  const [isNarrowView, setIsNarrowView] = useState(false);
  const [insightBgMode, setInsightBgMode] = useState<InsightBgMode>("auto");
  const [insightBgSingleUrl, setInsightBgSingleUrl] = useState("");
  const [insightBgListUrls, setInsightBgListUrls] = useState<string[]>([""]);
  const [insightBgSaved, setInsightBgSaved] = useState(false);
  const [insightBgModalOpen, setInsightBgModalOpen] = useState(false);
  /** 모달 내 탭: insight | weather */
  const [bgSettingTab, setBgSettingTab] = useState<"insight" | "weather">("insight");
  const [weatherBgUrls, setWeatherBgUrls] = useState<Record<WeatherThemeId, string[]>>(() => ({
    clear: [], partlyCloudy: [], fog: [], rain: [], snow: [], showers: [], thunderstorm: [], overcast: [],
  }));
  const [weatherBgSaved, setWeatherBgSaved] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrowView(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (insightTab !== "system") return;
    const s = getInsightBgSettings();
    setInsightBgMode(s.mode);
    if (s.mode === "single") setInsightBgSingleUrl(s.url);
    if (s.mode === "list") setInsightBgListUrls(s.urls.length > 0 ? s.urls : [""]);
  }, [insightTab]);

  useEffect(() => {
    if (!insightBgModalOpen) return;
    const s = getInsightBgSettings();
    setInsightBgMode(s.mode);
    if (s.mode === "single") setInsightBgSingleUrl(s.url);
    if (s.mode === "list") setInsightBgListUrls(s.urls.length > 0 ? s.urls : [""]);
    const w = getWeatherBgSettings();
    const themeIds: WeatherThemeId[] = ["clear", "partlyCloudy", "fog", "rain", "snow", "showers", "thunderstorm", "overcast"];
    setWeatherBgUrls((prev) => {
      const next = { ...prev };
      for (const id of themeIds) next[id] = w[id] ?? [];
      return next;
    });
  }, [insightBgModalOpen]);

  const refetchInsights = () => {
    setInsightLoading(true);
    loadInsightEntries()
      .then((result) => {
        setInsights(result.entries);
        setLastLoadFromSupabase(result.fromSupabase);
        setLastLoadError(result.errorMessage ?? null);
      })
      .catch(() => {
        setInsights(loadInsightEntriesFromStorage());
        setLastLoadFromSupabase(false);
        setLastLoadError(null);
      })
      .finally(() => setInsightLoading(false));
  };

  useEffect(() => {
    refetchInsights();
  }, []);

  useEffect(() => {
    if (insightTab === "system") {
      loadSystemInsights(RECOMMENDED_INSIGHTS).then(setSystemList);
    }
  }, [insightTab]);

  const sortedInsights = useMemo(
    () =>
      [...insights].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [insights]
  );

  /** 등록 연도 목록 (내가 저장한 문장 기준) */
  const systemFilterYears = useMemo(() => {
    const years = new Set(insights.map((e) => new Date(e.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [insights]);

  /** 기본 문장 탭: 내가 저장한 문장(최신순) + 시스템 기본 문장. 연/월 필터 시 해당 월 등록분만 */
  const systemFilteredWithIndex = useMemo(() => {
    const q = systemSearchQuery.trim().toLowerCase();
    const userItems: UnifiedItem[] = sortedInsights.map((e) => ({
      type: "user" as const,
      id: e.id,
      text: e.text,
      author: e.author,
      createdAt: e.createdAt,
    }));
    const systemItems: UnifiedItem[] = systemList.map((item, i) => ({
      type: "system" as const,
      index: i,
      quote: item.quote,
      author: item.author,
    }));
    let combined: UnifiedItem[] = [...userItems, ...systemItems];
    if (systemFilterYear !== "all" && systemFilterMonth !== "all") {
      combined = combined.filter((item) => {
        if (item.type !== "user") return false;
        const d = new Date(item.createdAt);
        return d.getFullYear() === systemFilterYear && d.getMonth() + 1 === systemFilterMonth;
      });
    }
    if (q) {
      combined = combined.filter((item) => {
        if (item.type === "user")
          return item.text.toLowerCase().includes(q) || (item.author ?? "").toLowerCase().includes(q);
        return item.quote.toLowerCase().includes(q) || item.author.toLowerCase().includes(q);
      });
    }
    return combined;
  }, [systemList, systemSearchQuery, sortedInsights, systemFilterYear, systemFilterMonth]);

  const SYSTEM_PER_PAGE = 10;
  const systemTotalPages = Math.max(1, Math.ceil(systemFilteredWithIndex.length / SYSTEM_PER_PAGE));
  const systemPaginatedList = useMemo(
    () =>
      systemFilteredWithIndex.slice(
        (systemPage - 1) * SYSTEM_PER_PAGE,
        systemPage * SYSTEM_PER_PAGE
      ),
    [systemFilteredWithIndex, systemPage]
  );

  useEffect(() => {
    setSystemPage(1);
  }, [systemSearchQuery, systemFilterYear, systemFilterMonth]);

  useEffect(() => {
    if (systemPage > systemTotalPages) setSystemPage(Math.max(1, systemTotalPages));
  }, [systemPage, systemTotalPages]);

  /** 편집 중인 항목: 시스템 인덱스 또는 user id */
  const [editingUnified, setEditingUnified] = useState<{ type: "system"; index: number } | { type: "user"; id: string } | null>(null);

  const systemSaveEdit = async () => {
    const q = systemEditQuote.trim();
    const a = systemEditAuthor.trim();
    if (!q) return;
    if (systemIsAdding) {
      const entry = await addInsightEntry(q, a || undefined);
      setInsights((prev) => [entry, ...prev]);
      setSystemIsAdding(false);
      setSystemEditQuote("");
      setSystemEditAuthor("");
    } else if (editingUnified) {
      if (editingUnified.type === "system") {
        const next = [...systemList];
        next[editingUnified.index] = { quote: q, author: a };
        setSystemList(next);
        await saveSystemInsights(next);
      } else {
        await updateInsightEntry(editingUnified.id, q, a || undefined);
        setInsights((prev) =>
          prev.map((e) => (e.id === editingUnified.id ? { ...e, text: q, author: a || undefined } : e))
        );
      }
      setEditingUnified(null);
    }
  };

  const systemCancelAddOrEdit = () => {
    setSystemIsAdding(false);
    setEditingUnified(null);
  };

  const systemDeleteAt = async (item: UnifiedItem) => {
    if (typeof window !== "undefined" && !window.confirm("이 문장을 목록에서 삭제할까요?")) return;
    if (item.type === "system") {
      const next = systemList.filter((_, idx) => idx !== item.index);
      setSystemList(next);
      await saveSystemInsights(next);
      if (editingUnified?.type === "system" && editingUnified.index === item.index) setEditingUnified(null);
      else if (editingUnified?.type === "system" && editingUnified.index > item.index)
        setEditingUnified({ type: "system", index: editingUnified.index - 1 });
    } else {
      setInsights((prev) => prev.filter((e) => e.id !== item.id));
      await deleteInsightEntry(item.id);
      if (editingUnified?.type === "user" && editingUnified.id === item.id) setEditingUnified(null);
    }
  };

  const handleDelete = async (id: string) => {
    setInsights((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteInsightEntry(id);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle
        title="인사이트"
        subtitle="요즘 마음에 남았던 한 문장을 조용히 모아두는 공간이에요."
      />

      {/* 상단: 일기장으로(인사이트 저장) + 문장 관리(현재) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/journal"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 transition bg-neutral-100 hover:bg-neutral-200"
          >
            인사이트 저장
          </Link>
          <span className="rounded-xl px-4 py-2.5 text-sm font-medium bg-neutral-900 text-white">
            문장 관리
          </span>
          <button
            type="button"
            onClick={() => setInsightBgModalOpen(true)}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 transition bg-neutral-100 hover:bg-neutral-200"
          >
            배경 설정
          </button>
        </div>
        {insightTab === "system" && (
          <div className="flex w-full items-center gap-2">
            <div className="relative flex min-w-0 flex-[2.2] md:max-w-[12rem] md:flex-initial md:w-44">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={systemSearchQuery}
                onChange={(e) => setSystemSearchQuery(e.target.value)}
                placeholder="문장·출처 검색"
                className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-8 pr-7 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
              />
              {systemSearchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSystemSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                  aria-label="검색어 지우기"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={systemFilterYear === "all" ? "all" : systemFilterYear}
              onChange={(e) => setSystemFilterYear(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="min-w-0 flex-[0.8] rounded-xl border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-800 md:flex-initial md:px-2.5"
            >
              <option value="all">{isNarrowView ? "연도" : "연도 전체"}</option>
              {systemFilterYears.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={systemFilterMonth === "all" ? "all" : systemFilterMonth}
              onChange={(e) => setSystemFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="min-w-0 flex-[0.8] rounded-xl border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-800 md:flex-initial md:px-2.5"
            >
              <option value="all">{isNarrowView ? "월" : "월 전체"}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {insightTab === "system" && (
        <>
          <Card className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base text-neutral-500">
                총 {systemFilteredWithIndex.length}개 문장{systemSearchQuery.trim() ? ` (검색)` : ""}{systemFilterYear !== "all" || systemFilterMonth !== "all" ? " (필터 적용)" : ""}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSystemIsAdding(true);
                  setSystemEditQuote("");
                  setSystemEditAuthor("");
                  setEditingUnified(null);
                }}
                disabled={systemIsAdding}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                + 문장 추가
              </button>
            </div>
            <div className="max-h-[70vh] min-w-0 space-y-3 overflow-y-auto">
              {systemIsAdding && (
                <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-4">
                  <div className="space-y-3">
                    <textarea
                      value={systemEditQuote}
                      onChange={(e) => setSystemEditQuote(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                      placeholder="문장"
                    />
                    <input
                      type="text"
                      value={systemEditAuthor}
                      onChange={(e) => setSystemEditAuthor(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                      placeholder="출처(인물명)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={systemSaveEdit}
                        className="rounded-lg bg-neutral-900 px-4 py-2 text-base font-medium text-white hover:bg-neutral-800"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={systemCancelAddOrEdit}
                        className="rounded-lg px-4 py-2 text-base text-neutral-500 hover:bg-neutral-200"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {systemPaginatedList.map((item, listIndex) => {
                const isEditing =
                  !systemIsAdding &&
                  ((item.type === "user" && editingUnified?.type === "user" && editingUnified.id === item.id) ||
                    (item.type === "system" && editingUnified?.type === "system" && editingUnified.index === item.index));
                const text = item.type === "user" ? item.text : item.quote;
                const author = item.type === "user" ? item.author ?? "" : item.author;
                const key = item.type === "user" ? `user-${item.id}` : `system-${item.index}`;
                return (
                  <div
                    key={key}
                    role={isEditing ? undefined : "button"}
                    tabIndex={isEditing ? undefined : 0}
                    onClick={
                      isEditing
                        ? undefined
                        : () => setSystemViewer({ list: systemPaginatedList, index: listIndex })
                    }
                    onKeyDown={
                      isEditing
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSystemViewer({ list: systemPaginatedList, index: listIndex });
                            }
                          }
                    }
                    className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 cursor-pointer"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={systemEditQuote}
                          onChange={(e) => setSystemEditQuote(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                          placeholder="문장"
                        />
                        <input
                          type="text"
                          value={systemEditAuthor}
                          onChange={(e) => setSystemEditAuthor(e.target.value)}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                          placeholder="출처(인물명)"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={systemSaveEdit}
                            className="rounded-lg bg-neutral-900 px-4 py-2 text-base font-medium text-white hover:bg-neutral-800"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={systemCancelAddOrEdit}
                            className="rounded-lg px-4 py-2 text-base text-neutral-500 hover:bg-neutral-200"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="flex justify-end gap-1 sm:order-2 sm:shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSystemIsAdding(false);
                              setEditingUnified(item.type === "user" ? { type: "user", id: item.id } : { type: "system", index: item.index });
                              setSystemEditQuote(text);
                              setSystemEditAuthor(author);
                            }}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                            aria-label="수정"
                            title="수정"
                          >
                            <svg className="h-5 w-5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); systemDeleteAt(item); }}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                            aria-label="삭제"
                            title="삭제"
                          >
                            <svg className="h-5 w-5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="min-w-0 flex-1 pl-3 sm:order-1">
                          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-neutral-800 md:text-lg">
                            {text}
                          </p>
                          {author && (
                            <p className="mt-1 text-sm text-neutral-500">— {author}</p>
                          )}
                          {item.type === "user" && (
                            <p className="mt-1 text-xs text-neutral-400">{formatDate(item.createdAt)}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {systemTotalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSystemPage((p) => Math.max(1, p - 1))}
                  disabled={systemPage <= 1}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none"
                >
                  이전
                </button>
                {/* 모바일: 최대 5개 페이지 번호만 표시 */}
                {(() => {
                  const start = Math.max(1, systemPage - 2);
                  const end = Math.min(systemTotalPages, systemPage + 2);
                  const mobilePages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                  return (
                    <>
                      <div className="flex gap-2 sm:hidden">
                        {mobilePages.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setSystemPage(p)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                              systemPage === p ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div className="hidden gap-2 sm:flex">
                        {Array.from({ length: systemTotalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setSystemPage(p)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                              systemPage === p ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setSystemPage((p) => Math.min(systemTotalPages, p + 1))}
                  disabled={systemPage >= systemTotalPages}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none"
                >
                  다음
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* 기본 문장 탭: 문장 보기 모달 (가로폭 고정) */}
      {systemViewer &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const item = systemViewer.list[systemViewer.index];
            const modalText = item ? (item.type === "user" ? item.text : item.quote) : "";
            const modalAuthor = item ? (item.type === "user" ? item.author : item.author) : "";
            const modalDate = item?.type === "user" ? formatDate(item.createdAt) : null;
            return (
              <div
                className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/75 p-4"
                style={{ top: 0, left: 0, right: 0, bottom: 0 }}
                onClick={() => setSystemViewer(null)}
                role="dialog"
                aria-modal="true"
                aria-label="문장 보기"
              >
                <div
                  className="relative flex w-[min(90vw,36rem)] flex-shrink-0 flex-col items-center gap-4 sm:flex-row sm:gap-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setSystemViewer((v) => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
                    disabled={systemViewer.index <= 0}
                    className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none sm:flex"
                    aria-label="이전 문장"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="order-1 flex w-[min(90vw,36rem)] max-h-[85vh] flex-shrink-0 flex-col rounded-3xl bg-white shadow-2xl sm:order-none">
                    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-10 sm:px-12 sm:py-14">
                      <p className="font-insight-serif whitespace-pre-wrap text-xl leading-relaxed text-neutral-800 sm:text-2xl sm:leading-relaxed">
                        {modalText}
                      </p>
                      {modalAuthor && (
                        <p className="mt-3 text-base text-neutral-500">— {modalAuthor}</p>
                      )}
                    </div>
                    {modalDate && (
                      <div className="shrink-0 border-t border-neutral-100 px-8 py-3 sm:px-12">
                        <span className="text-sm text-neutral-500">{modalDate}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSystemViewer((v) =>
                        v && v.index < v.list.length - 1 ? { ...v, index: v.index + 1 } : v
                      )
                    }
                    disabled={systemViewer.index >= systemViewer.list.length - 1}
                    className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none sm:flex"
                    aria-label="다음 문장"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="order-2 flex gap-4 sm:hidden">
                    <button
                      type="button"
                      onClick={() => setSystemViewer((v) => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
                      disabled={systemViewer.index <= 0}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="이전 문장"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSystemViewer((v) =>
                          v && v.index < v.list.length - 1 ? { ...v, index: v.index + 1 } : v
                        )
                      }
                      disabled={systemViewer.index >= systemViewer.list.length - 1}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="다음 문장"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}
      {insightBgModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insight-bg-modal-title"
          >
            <div
              className="fixed inset-0 bg-black/70"
              aria-hidden
              onClick={() => setInsightBgModalOpen(false)}
            />
            <div
              className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="insight-bg-modal-title" className="text-base font-semibold text-neutral-800">
                  배경 설정
                </h2>
                <button
                  type="button"
                  onClick={() => setInsightBgModalOpen(false)}
                  className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="닫기"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mb-4 flex gap-2 border-b border-neutral-200 pb-3">
                <button
                  type="button"
                  onClick={() => setBgSettingTab("insight")}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${bgSettingTab === "insight" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                >
                  투데이 인사이트 배경
                </button>
                <button
                  type="button"
                  onClick={() => setBgSettingTab("weather")}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${bgSettingTab === "weather" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                >
                  날씨 박스 배경
                </button>
              </div>
              {bgSettingTab === "insight" && (
              <>
              <p className="mb-4 text-xs text-neutral-500">
                홈 카드 배경을 자동(Picsum), 한 장 고정, 또는 내 URL 목록 순환 중에서 선택할 수 있어요.
              </p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="insightBgModeModal"
                    checked={insightBgMode === "auto"}
                    onChange={() => setInsightBgMode("auto")}
                    className="h-4 w-4 border-neutral-300 text-neutral-700"
                  />
                  <span className="text-sm text-neutral-700">자동 (Picsum, 12시간마다 바뀜)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="insightBgModeModal"
                    checked={insightBgMode === "single"}
                    onChange={() => setInsightBgMode("single")}
                    className="h-4 w-4 border-neutral-300 text-neutral-700"
                  />
                  <span className="text-sm text-neutral-700">한 장 고정 (URL 1개)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="insightBgModeModal"
                    checked={insightBgMode === "list"}
                    onChange={() => setInsightBgMode("list")}
                    className="h-4 w-4 border-neutral-300 text-neutral-700"
                  />
                  <span className="text-sm text-neutral-700">내 URL 목록 순환 (12시간마다)</span>
                </label>
              </div>
              {insightBgMode === "single" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    value={insightBgSingleUrl}
                    onChange={(e) => setInsightBgSingleUrl(e.target.value)}
                    placeholder="https://..."
                    className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50 md:min-w-[16rem]"
                  />
                </div>
              )}
              {insightBgMode === "list" && (
                <div className="mt-3 space-y-2">
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
              <div className="mt-4 flex flex-wrap items-center gap-2">
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
                      setInsightBgSingleUrl("");
                      setInsightBgListUrls([""]);
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
                <p className="mt-2 text-xs text-green-600">적용되었어요. 홈에서 확인해 보세요.</p>
              )}
              </>
              )}
              {bgSettingTab === "weather" && (
              <>
              <p className="mb-4 text-xs text-neutral-500">
                날씨별로 이미지 URL을 여러 장씩 등록할 수 있어요. 해당 날씨일 때 그중 한 장이 랜덤으로 배경에 표시돼요.
              </p>
              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
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
              <div className="mt-4 flex items-center gap-2">
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
              </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function InsightPage() {
  return (
    <Suspense
      fallback={
        <div className="min-w-0 space-y-6">
          <SectionTitle title="인사이트" subtitle="요즘 마음에 남았던 한 문장을 조용히 모아두는 공간이에요." />
          <p className="text-sm text-neutral-500">불러오는 중…</p>
        </div>
      }
    >
      <InsightPageContent />
    </Suspense>
  );
}

