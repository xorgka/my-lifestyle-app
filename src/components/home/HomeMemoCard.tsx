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
          <Link
            href="/memo"
            className="flex flex-shrink-0 items-center justify-between gap-2 rounded-t-[10px] border-b border-black/10 px-4 py-1 no-underline"
            style={{ backgroundColor: MEMO_COLORS.black.headerBg, color: MEMO_COLORS.black.headerFg }}
            aria-label="메모 페이지로 이동"
          >
            <span className="text-[17px] font-semibold opacity-0">제목</span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-25 [&_svg]:size-4" style={{ color: MEMO_COLORS.black.headerFg }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </span>
          </Link>
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
        <div className="relative flex h-full min-h-0 flex-1 flex-row items-stretch gap-1 md:gap-3">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={!canPrev}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 shrink-0 self-center rounded-full bg-white/90 p-2 text-neutral-400 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400 md:static md:left-auto md:top-auto md:translate-y-0 md:bg-transparent md:p-2 md:shadow-none"
            aria-label="이전 메모"
          >
            <svg className="h-5 w-5 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex min-h-0 min-w-0 flex-1 overflow-visible w-full">
            {currentMemo && (
              <MemoCard
                memo={currentMemo}
                variant="preview"
                className="h-full min-h-0 w-full flex-shrink-0"
                headerHref="/memo"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(pinnedMemos.length - 1, i + 1))}
            disabled={!canNext}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 shrink-0 self-center rounded-full bg-white/90 p-2 text-neutral-400 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400 md:static md:right-auto md:top-auto md:translate-y-0 md:bg-transparent md:p-2 md:shadow-none"
            aria-label="다음 메모"
          >
            <svg className="h-5 w-5 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
