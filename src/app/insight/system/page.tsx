"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { RECOMMENDED_INSIGHTS } from "@/components/home/TodayInsightHero";
import {
  loadSystemInsights,
  saveSystemInsights,
  type QuoteEntry,
} from "@/lib/insights";

export default function InsightSystemPage() {
  const [list, setList] = useState<QuoteEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editQuote, setEditQuote] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  const filteredWithIndex = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let items = list.map((item, i) => ({ item, originalIndex: i }));
    if (q) {
      items = items.filter(
        ({ item }) =>
          item.quote.toLowerCase().includes(q) || item.author.toLowerCase().includes(q)
      );
    }
    // 표시 순서: 최신순(새로 추가한 것 먼저)
    return [...items].reverse();
  }, [list, searchQuery]);

  useEffect(() => {
    loadSystemInsights(RECOMMENDED_INSIGHTS).then(setList);
  }, []);

  const saveEdit = async () => {
    if (editingIndex == null && !isAdding) return;
    const q = editQuote.trim();
    const a = editAuthor.trim();
    if (!q) return;
    if (isAdding) {
      const next = [...list, { quote: q, author: a }];
      setList(next);
      await saveSystemInsights(next);
      setIsAdding(false);
      setEditQuote("");
      setEditAuthor("");
    } else if (editingIndex != null) {
      const next = [...list];
      next[editingIndex] = { quote: q, author: a };
      setList(next);
      await saveSystemInsights(next);
      setEditingIndex(null);
    }
  };

  const cancelAddOrEdit = () => {
    setIsAdding(false);
    setEditingIndex(null);
  };

  const deleteAt = async (i: number) => {
    if (typeof window !== "undefined" && !window.confirm("이 문장을 목록에서 삭제할까요?")) return;
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    await saveSystemInsights(next);
    if (editingIndex === i) setEditingIndex(null);
    else if (editingIndex != null && editingIndex > i) setEditingIndex(editingIndex - 1);
  };

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle
        title="기본 문장 관리"
        subtitle="홈의 오늘의 인사이트에 섞여 나오는 시스템 기본 문장을 추가·수정·삭제할 수 있어요."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/insight"
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-base font-medium text-neutral-600 hover:bg-neutral-50"
        >
          ← 인사이트로
        </Link>
        <div className="relative flex min-w-0 sm:w-56">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="문장·출처 검색"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
          />
        </div>
      </div>

      <Card className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base text-neutral-500">
            총 {list.length}개 문장{searchQuery.trim() ? ` (검색 결과 ${filteredWithIndex.length}개)` : ""}.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setEditQuote("");
              setEditAuthor("");
              setEditingIndex(null);
            }}
            disabled={isAdding}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            + 문장 추가
          </button>
        </div>
        <div className="max-h-[70vh] min-w-0 space-y-3 overflow-y-auto">
          {isAdding && (
            <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-4">
              <div className="space-y-3">
                <textarea
                  value={editQuote}
                  onChange={(e) => setEditQuote(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                  placeholder="문장"
                />
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                  placeholder="출처(인물명)"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-base font-medium text-white hover:bg-neutral-800"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={cancelAddOrEdit}
                    className="rounded-lg px-4 py-2 text-base text-neutral-500 hover:bg-neutral-200"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
          {filteredWithIndex.map(({ item, originalIndex: i }) => (
            <div
              key={`${i}-${item.quote.slice(0, 20)}`}
              className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4"
            >
              {editingIndex === i ? (
                <div className="space-y-3">
                  <textarea
                    value={editQuote}
                    onChange={(e) => setEditQuote(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                    placeholder="문장"
                  />
                  <input
                    type="text"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900"
                    placeholder="출처(인물명)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-base font-medium text-white hover:bg-neutral-800"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={cancelAddOrEdit}
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
                      onClick={() => {
                        setIsAdding(false);
                        setEditingIndex(i);
                        setEditQuote(item.quote);
                        setEditAuthor(item.author);
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
                      onClick={() => deleteAt(i)}
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
                      {item.quote}
                    </p>
                    {item.author && (
                      <p className="mt-1 text-sm text-neutral-500">— {item.author}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
