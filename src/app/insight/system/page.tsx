"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { RECOMMENDED_INSIGHTS } from "@/components/home/TodayInsightHero";
import {
  loadSystemInsights,
  saveSystemInsights,
  resetSystemInsightsToDefault,
  type QuoteEntry,
} from "@/lib/insights";

export default function InsightSystemPage() {
  const [list, setList] = useState<QuoteEntry[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuote, setEditQuote] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  useEffect(() => {
    loadSystemInsights(RECOMMENDED_INSIGHTS).then(setList);
  }, []);

  const saveEdit = async () => {
    if (editingIndex == null) return;
    const q = editQuote.trim();
    const a = editAuthor.trim();
    if (!q) return;
    const next = [...list];
    next[editingIndex] = { quote: q, author: a };
    setList(next);
    await saveSystemInsights(next);
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

  const resetToDefault = async () => {
    if (typeof window !== "undefined" && !window.confirm("기본 문장 목록으로 되돌릴까요? (수정·삭제한 내용이 사라집니다)")) return;
    await resetSystemInsightsToDefault(RECOMMENDED_INSIGHTS);
    setList(RECOMMENDED_INSIGHTS);
    setEditingIndex(null);
  };

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle
        title="기본 문장 관리"
        subtitle="홈의 오늘의 인사이트에 섞여 나오는 시스템 기본 문장을 수정·삭제할 수 있어요."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/insight"
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-base font-medium text-neutral-600 hover:bg-neutral-50"
        >
          ← 인사이트로
        </Link>
        <button
          type="button"
          onClick={resetToDefault}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-base font-medium text-amber-800 hover:bg-amber-100"
        >
          기본 목록으로 되돌리기
        </button>
      </div>

      <Card className="min-w-0 space-y-4">
        <p className="text-base text-neutral-500">
          총 {list.length}개 문장. Supabase 연결 시 다른 기기와 동기화돼요.
        </p>
        <div className="max-h-[70vh] min-w-0 space-y-3 overflow-y-auto">
          {list.map((item, i) => (
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
                      onClick={() => setEditingIndex(null)}
                      className="rounded-lg px-4 py-2 text-base text-neutral-500 hover:bg-neutral-200"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-800 md:text-lg">
                    {item.quote}
                  </p>
                  {item.author && (
                    <p className="mt-1 text-sm text-neutral-500">— {item.author}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIndex(i);
                        setEditQuote(item.quote);
                        setEditAuthor(item.author);
                      }}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-200"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAt(i)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
