"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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

export default function InsightPage() {
  const [input, setInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [insights, setInsights] = useState<InsightEntry[]>([]);
  const [insightLoading, setInsightLoading] = useState(true);
  /** 마지막 로드가 Supabase에서 성공했으면 true, 폴백(로컬)이면 false */
  const [lastLoadFromSupabase, setLastLoadFromSupabase] = useState<boolean | null>(null);
  /** 동기화 실패 시 오류 메시지 (모바일 디버깅용) */
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingAuthor, setEditingAuthor] = useState("");
  const [viewer, setViewer] = useState<{ list: InsightEntry[]; index: number } | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  function resizeEditTextarea(ta: HTMLTextAreaElement | null) {
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

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

  const sortedInsights = useMemo(
    () =>
      [...insights].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [insights]
  );

  const recentInsights = useMemo(
    () => sortedInsights.slice(0, 5),
    [sortedInsights]
  );

  const monthGroups = useMemo(() => {
    const groups: Record<
      string,
      { label: string; items: InsightEntry[] }
    > = {};

    for (const item of sortedInsights) {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const label = d.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
      });
      if (!groups[key]) {
        groups[key] = { label, items: [] };
      }
      groups[key].items.push(item);
    }

    return groups;
  }, [sortedInsights]);

  const monthEntries = useMemo(
    () =>
      Object.entries(monthGroups).sort((a, b) => {
        const [keyA] = a;
        const [keyB] = b;
        return keyA < keyB ? 1 : -1;
      }),
    [monthGroups]
  );

  const selectedMonthItems =
    selectedMonthKey && monthGroups[selectedMonthKey]
      ? monthGroups[selectedMonthKey].items
      : [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const author = authorInput.trim();
    setInput("");
    setAuthorInput("");
    try {
      const item = await addInsightEntry(trimmed, author || undefined);
      setInsights((prev) => [item, ...prev]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (editingId === id) {
      setEditingId(null);
      setEditingText("");
    }
    setInsights((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteInsightEntry(id);
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (item: InsightEntry) => {
    setEditingId(item.id);
    setEditingText(item.text);
    setEditingAuthor(item.author ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
    setEditingAuthor("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const author = editingAuthor.trim() || undefined;
    setInsights((prev) =>
      prev.map((item) =>
        item.id === editingId ? { ...item, text: trimmed, author } : item
      )
    );
    setEditingId(null);
    setEditingText("");
    setEditingAuthor("");
    try {
      await updateInsightEntry(editingId, trimmed, author);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (editingId != null) {
      requestAnimationFrame(() => resizeEditTextarea(editTextareaRef.current));
    }
  }, [editingId, editingText]);

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

      {/* 입력 영역 - 은은한 그라데이션으로 구분, 우측 상단 톱니(기본 문장 관리) */}
      <Card className="relative min-w-0 space-y-4 bg-gradient-to-br from-white via-[#f5f5f7] to-white shadow-[0_18px_45px_rgba(0,0,0,0.08)] ring-1 ring-neutral-300">
        <Link
          href="/insight/system"
          className="absolute right-4 top-4 rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          title="기본 문장 관리"
          aria-label="기본 문장 관리"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <h2 className="pr-10 text-xl font-semibold text-neutral-900">
          오늘 마음에 남은 문장
        </h2>
        <p className="text-sm text-neutral-500">
          책, 영상, 대화, 우연히 떠오른 생각까지. 한 줄씩만 남겨두면,
          나중에 다시 읽을 때 오늘의 나를 떠올릴 수 있어요.
        </p>

        <form onSubmit={handleAdd} className="mt-2 space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="감명받은 문장이나 오늘의 인사이트를 한 줄로 적어보세요."
            className="w-full resize-none rounded-2xl border border-soft-border bg-white px-3.5 py-3 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 hover:border-neutral-400"
          />
          <input
            type="text"
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            placeholder="출처(인물명)"
            className="w-full rounded-2xl border border-soft-border bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 hover:border-neutral-400"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500">
            <span>
              {input.trim().length > 0 ? `${input.trim().length} 글자` : ""}
            </span>
            <button
              type="submit"
              className="w-full shrink-0 rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)] sm:w-auto"
            >
              인사이트 저장하기
            </button>
          </div>
        </form>
      </Card>

      {insightLoading && (
        <p className="text-sm text-neutral-500">인사이트 불러오는 중…</p>
      )}

      {!insightLoading && insights.length === 0 && (
        <Card className="min-w-0">
          {!isSupabaseConfigured ? (
            <p className="text-sm text-neutral-600">
              기기 간 동기화를 사용하려면 Supabase가 필요합니다. 프로젝트 루트의 .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정한 뒤 다시 빌드해 주세요.
            </p>
          ) : lastLoadFromSupabase === false ? (
            <>
              <p className="text-sm text-neutral-600">
                동기화에 실패했을 수 있습니다. 네트워크 연결을 확인한 뒤 아래 버튼으로 다시 불러오기 해 보세요.
              </p>
              {lastLoadError && (
                <p className="mt-2 text-xs text-neutral-500" title="개발자 도구에서도 확인 가능">
                  오류: {lastLoadError}
                </p>
              )}
              <p className="mt-2 text-xs text-neutral-500">
                모바일에서 계속 실패하면, Supabase 대시보드 → Settings → API에서 이 사이트 주소가 허용 목록에 있는지 확인해 보세요.
              </p>
              <button
                type="button"
                onClick={refetchInsights}
                className="mt-3 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                다시 불러오기
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-600">
                아직 저장한 문장이 없어요. 위에서 문장을 추가해 보세요.
              </p>
              <button
                type="button"
                onClick={refetchInsights}
                className="mt-3 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                다시 불러오기
              </button>
            </>
          )}
        </Card>
      )}

      {/* 최근 5개 */}
      {!insightLoading && recentInsights.length > 0 && (
        <Card className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            최근에 남긴 문장 (최신 5개)
          </h2>
          <div className="mt-2 min-w-0 space-y-3 text-[0.95rem]">
            {recentInsights.map((item) => (
              <div
                key={item.id}
                role={editingId === item.id ? undefined : "button"}
                tabIndex={editingId === item.id ? undefined : 0}
                onClick={
                  editingId === item.id
                    ? undefined
                    : () => setViewer({ list: recentInsights, index: recentInsights.findIndex((i) => i.id === item.id) })
                }
                onKeyDown={
                  editingId === item.id
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setViewer({ list: recentInsights, index: recentInsights.findIndex((i) => i.id === item.id) });
                        }
                      }
                }
                className="group min-w-0 cursor-pointer rounded-3xl border border-neutral-200/70 bg-neutral-50 px-6 py-4 ring-1 ring-transparent transition-all hover:bg-white hover:ring-soft-border/80 hover:shadow-[0_14px_34px_rgba(0,0,0,0.06)]"
              >
                {editingId === item.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      ref={editTextareaRef}
                      value={editingText}
                      onChange={(e) => {
                        setEditingText(e.target.value);
                        const ta = e.target as HTMLTextAreaElement;
                        ta.style.height = "auto";
                        ta.style.height = `${ta.scrollHeight}px`;
                      }}
                      rows={2}
                      className="min-h-[4.5rem] w-full resize-none overflow-hidden rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                    <input
                      type="text"
                      value={editingAuthor}
                      onChange={(e) => setEditingAuthor(e.target.value)}
                      placeholder="출처(인물명)"
                      className="w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    />
                    <div className="flex items-center justify-end gap-2 text-sm">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-2xl px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="rounded-2xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="max-w-full text-base leading-relaxed line-clamp-1 text-neutral-600 sm:text-[17px]">{item.text}</p>
                    {item.author && (
                      <p className="text-sm text-neutral-500">— {item.author}</p>
                    )}
                    <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                      <span>{formatDate(item.createdAt)}</span>
                      <div className="flex gap-2 opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-full px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-full px-2.5 py-1 text-xs text-red-500 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 월별 아카이브 */}
      {!insightLoading && monthEntries.length > 0 && (
        <Card className="min-w-0 space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">
              월별로 모아보기
            </h2>
            <span className="text-sm text-neutral-400">
              총 {insights.length}개의 문장을 저장했어요.
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-base">
            {monthEntries.map(([key, { label, items }]) => {
              const active = key === selectedMonthKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setSelectedMonthKey((prev) => (prev === key ? null : key))
                  }
                  className={`rounded-2xl px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {label}
                  <span className="ml-1 text-xs text-neutral-300">
                    {items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedMonthKey && selectedMonthItems.length > 0 && (
            <div className="mt-3 max-h-80 min-w-0 space-y-3 overflow-y-auto pr-1 text-[0.95rem]">
              {selectedMonthItems.map((item) => (
                <div
                  key={item.id}
                  role={editingId === item.id ? undefined : "button"}
                  tabIndex={editingId === item.id ? undefined : 0}
                  onClick={
                    editingId === item.id
                      ? undefined
                      : () => setViewer({ list: selectedMonthItems, index: selectedMonthItems.findIndex((i) => i.id === item.id) })
                  }
                  onKeyDown={
                    editingId === item.id
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setViewer({ list: selectedMonthItems, index: selectedMonthItems.findIndex((i) => i.id === item.id) });
                          }
                        }
                  }
                  className="group min-w-0 cursor-pointer rounded-3xl border border-neutral-200/70 bg-neutral-50 px-6 py-4 text-sm text-neutral-600 ring-1 ring-transparent transition-all hover:bg-white hover:ring-soft-border/80 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] sm:text-[17px]"
                >
                  {editingId === item.id ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        ref={editTextareaRef}
                        value={editingText}
                        onChange={(e) => {
                          setEditingText(e.target.value);
                          const ta = e.target as HTMLTextAreaElement;
                          ta.style.height = "auto";
                          ta.style.height = `${ta.scrollHeight}px`;
                        }}
                        rows={2}
                        className="min-h-[4.5rem] w-full resize-none overflow-hidden rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                      />
                      <input
                        type="text"
                        value={editingAuthor}
                        onChange={(e) => setEditingAuthor(e.target.value)}
                        placeholder="출처(인물명)"
                        className="w-full rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                      />
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-2xl px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-2xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="max-w-full text-base leading-relaxed line-clamp-1 text-neutral-600 sm:text-[17px]">{item.text}</p>
                      {item.author && (
                        <p className="text-sm text-neutral-500">— {item.author}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                        <span>{formatDate(item.createdAt)}</span>
                        <div className="flex gap-2 opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-full px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-full px-2.5 py-1 text-xs text-red-500 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 문장 뷰어 모달 */}
      {viewer &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/75 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setViewer(null)}
            role="dialog"
            aria-modal="true"
            aria-label="문장 보기"
          >
            <div
              className="relative flex min-w-0 max-w-3xl flex-col items-center gap-4 sm:flex-row sm:gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* PC: 좌측 화살표 */}
              <button
                type="button"
                onClick={() => setViewer((v) => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
                disabled={viewer.index <= 0}
                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none sm:flex"
                aria-label="이전 문장"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="order-1 min-w-0 flex-1 rounded-3xl bg-white px-8 py-10 shadow-2xl sm:order-none sm:px-12 sm:py-14">
                <p className="font-insight-serif whitespace-pre-wrap text-xl leading-relaxed text-neutral-800 sm:text-2xl sm:leading-relaxed">
                  {viewer.list[viewer.index]?.text}
                </p>
                {viewer.list[viewer.index]?.author && (
                  <p className="mt-3 text-base text-neutral-500">— {viewer.list[viewer.index].author}</p>
                )}
                <div className="mt-6 flex w-full items-center justify-between text-sm">
                  <span className="text-neutral-500">
                    {viewer.list[viewer.index] && formatDate(viewer.list[viewer.index].createdAt)}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {viewer.index + 1} / {viewer.list.length}
                  </span>
                </div>
              </div>

              {/* PC: 우측 화살표 */}
              <button
                type="button"
                onClick={() =>
                  setViewer((v) =>
                    v && v.index < v.list.length - 1 ? { ...v, index: v.index + 1 } : v
                  )
                }
                disabled={viewer.index >= viewer.list.length - 1}
                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none sm:flex"
                aria-label="다음 문장"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* 모바일: 화살표 하단 */}
              <div className="order-2 flex gap-4 sm:hidden">
                <button
                  type="button"
                  onClick={() => setViewer((v) => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
                  disabled={viewer.index <= 0}
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
                    setViewer((v) =>
                      v && v.index < v.list.length - 1 ? { ...v, index: v.index + 1 } : v
                    )
                  }
                  disabled={viewer.index >= viewer.list.length - 1}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-lg transition hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="다음 문장"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

