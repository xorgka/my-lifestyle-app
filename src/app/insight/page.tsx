"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";

type InsightItem = {
  id: number;
  text: string;
  createdAt: string; // ISO string
};

const STORAGE_KEY = "my-lifestyle-insights";

export default function InsightPage() {
  const [input, setInput] = useState("");
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as InsightItem[];
      setInsights(parsed);
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(insights));
  }, [insights]);

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
      { label: string; items: InsightItem[] }
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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const now = new Date();
    const item: InsightItem = {
      id: now.getTime(),
      text: trimmed,
      createdAt: now.toISOString(),
    };

    setInsights((prev) => [item, ...prev]);
    setInput("");
  };

  const handleDelete = (id: number) => {
    setInsights((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingText("");
    }
  };

  const startEdit = (item: InsightItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    setInsights((prev) =>
      prev.map((item) =>
        item.id === editingId ? { ...item, text: trimmed } : item
      )
    );
    setEditingId(null);
    setEditingText("");
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
      <p className="text-sm text-neutral-500">
        <Link href="/insight/system" className="underline hover:text-neutral-700">
          기본 문장 수정/삭제
        </Link>
        {" "}— 홈에 나오는 시스템 문장을 웹에서 관리할 수 있어요.
      </p>

      {/* 입력 영역 - 은은한 그라데이션으로 구분 */}
      <Card className="min-w-0 space-y-4 bg-gradient-to-br from-white via-[#f5f5f7] to-white shadow-[0_18px_45px_rgba(0,0,0,0.08)] ring-1 ring-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900">
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

      {/* 최근 5개 */}
      {recentInsights.length > 0 && (
        <Card className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            최근에 남긴 문장 (최신 5개)
          </h2>
          <div className="mt-2 min-w-0 space-y-3 text-[0.95rem]">
            {recentInsights.map((item) => (
              <div
                key={item.id}
                className="group min-w-0 rounded-3xl bg-neutral-50 px-6 py-4 text-base text-neutral-900 ring-1 ring-transparent transition-all hover:bg-white hover:ring-soft-border/80 hover:shadow-[0_14px_34px_rgba(0,0,0,0.06)]"
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
                    <p className="max-w-full text-lg leading-relaxed">{item.text}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                      <span>{formatDate(item.createdAt)}</span>
                      <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
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
      {monthEntries.length > 0 && (
        <Card className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
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
                  className="group min-w-0 rounded-3xl bg-neutral-50 px-6 py-4 text-sm text-neutral-900 ring-1 ring-transparent transition-all hover:bg-white hover:ring-soft-border/80 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)]"
                >
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-2xl border border-soft-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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
                      <p className="max-w-full text-lg leading-relaxed">{item.text}</p>
                      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                        <span>{formatDate(item.createdAt)}</span>
                        <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
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
    </div>
  );
}

