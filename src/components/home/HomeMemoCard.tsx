"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MemoCard } from "@/components/memo/MemoCard";
import { loadMemos, type Memo } from "@/lib/memoDb";
import { MEMO_COLORS } from "@/lib/memoDb";

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

  const linkToMemo = (
    <Link
      href="/memo"
      className="flex h-8 w-8 items-center justify-center rounded text-2xl font-light opacity-70 transition hover:opacity-100"
      style={{ color: "#f3f4f6" }}
      aria-label="메모 페이지로 이동"
      title="메모"
    >
      +
    </Link>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-visible">
      {pinnedMemos.length === 0 ? (
        <div
          className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-[0_6px_20px_rgba(0,0,0,0.12)]"
          style={{
            backgroundColor: MEMO_COLORS.black.bodyBg,
            borderColor: "rgba(0,0,0,0.11)",
          }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-end gap-1 rounded-t-[10px] border-b border-black/10 px-4 py-1"
            style={{ backgroundColor: MEMO_COLORS.black.headerBg, color: MEMO_COLORS.black.headerFg }}
          >
            {linkToMemo}
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <p className="text-base text-neutral-600">고정한 메모가 없어요</p>
            <Link
              href="/memo"
              className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
            >
              메모에서 별표로 고정하기
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-1 flex-row items-stretch gap-1 md:gap-3">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={!canPrev}
            className="shrink-0 self-center rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400 md:p-2"
            aria-label="이전 메모"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex min-h-0 min-w-0 flex-1 overflow-visible">
            {currentMemo && (
              <MemoCard
                memo={currentMemo}
                variant="preview"
                className="h-full min-h-0 w-full flex-shrink-0"
                headerRight={linkToMemo}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(pinnedMemos.length - 1, i + 1))}
            disabled={!canNext}
            className="shrink-0 self-center rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400 md:p-2"
            aria-label="다음 메모"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
