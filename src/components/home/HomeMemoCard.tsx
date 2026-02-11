"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadMemos, type Memo } from "@/lib/memoDb";

export function HomeMemoCard() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    loadMemos().then((raw) => {
      const pinned = raw
        .filter((m) => m.pinned)
        .sort((a, b) => {
          const aAt = a.pinnedAt ?? a.createdAt;
          const bAt = b.pinnedAt ?? b.createdAt;
          return new Date(bAt).getTime() - new Date(aAt).getTime();
        });
      setMemos(pinned);
    });
  }, []);

  const pinnedMemos = memos;
  const safeIndex = Math.min(index, Math.max(0, pinnedMemos.length - 1));
  const currentMemo = pinnedMemos[safeIndex];
  const canPrev = pinnedMemos.length > 1 && safeIndex > 0;
  const canNext = pinnedMemos.length > 1 && safeIndex < pinnedMemos.length - 1;

  return (
    <div className="relative flex h-[280px] w-full flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
      {/* 헤더: #FBD149, 세로 높이 줄임, 글자 두껍게 */}
      <div
        className="flex-shrink-0 px-7 py-2.5"
        style={{ backgroundColor: "#FBD149" }}
      >
        <Link
          href="/memo"
          className="block truncate text-lg font-bold no-underline hover:opacity-90"
          style={{ color: "#3D3009" }}
          aria-label="메모 페이지로 이동"
        >
          {currentMemo ? (currentMemo.title?.trim() || "메모") : "메모"}
        </Link>
      </div>

      {/* 내용 영역: 하얀색, 메모지 가로선, 글자 두껍게 */}
      <div
        className="flex min-h-0 flex-1 flex-col bg-white px-7 py-5"
        style={{
          backgroundImage: "repeating-linear-gradient(transparent, transparent 0px, transparent 27px, rgba(0,0,0,0.08) 27px, rgba(0,0,0,0.08) 28px)",
        }}
      >
        {pinnedMemos.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-sm font-semibold text-neutral-600">고정한 메모가 없어요</p>
            <Link
              href="/memo"
              className="text-sm font-semibold text-neutral-700 underline underline-offset-2 hover:text-black"
            >
              메모에서 별표로 고정하기
            </Link>
          </div>
        ) : currentMemo ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden text-[15px] font-semibold text-black whitespace-pre-wrap break-words md:text-base scrollbar-hide"
            style={{ lineHeight: "28px" }}
          >
            {currentMemo.content.trim() || "내용 없음"}
          </div>
        ) : null}

        {pinnedMemos.length > 1 && (
          <div className="flex flex-shrink-0 justify-end gap-0.5 pt-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={!canPrev}
              className="rounded p-1.5 text-neutral-600 transition hover:text-black disabled:opacity-30"
              aria-label="이전 메모"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(pinnedMemos.length - 1, i + 1))}
              disabled={!canNext}
              className="rounded p-1.5 text-neutral-600 transition hover:text-black disabled:opacity-30"
              aria-label="다음 메모"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
