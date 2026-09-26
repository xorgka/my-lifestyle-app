"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadMemos, type Memo } from "@/lib/memoDb";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";
import { getMemoCardStyle, MEMO_CARD_STYLE_CHANGED_EVENT, type MemoCardStyle } from "@/lib/homeTemplate";

const MEMO_HEADER_BG = "#FEE768";

function formatHeaderDate(): string {
  const d = new Date();
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** 카드형 하단 날짜: WED, 26 APR 23 */
function formatCardDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "2-digit" })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

export function HomeMemoCard() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [index, setIndex] = useState(0);
  const [cardStyle, setCardStyle] = useState<MemoCardStyle>("classic");

  useEffect(() => {
    const sync = () => setCardStyle(getMemoCardStyle());
    sync();
    window.addEventListener(MEMO_CARD_STYLE_CHANGED_EVENT, sync);
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MEMO_CARD_STYLE_CHANGED_EVENT, sync);
      window.removeEventListener(USER_SETTINGS_SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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

  if (cardStyle === "card") {
    return (
      <div className="relative flex h-[280px] w-full flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
        {pinnedMemos.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <p className="text-sm font-medium text-neutral-600">고정한 메모가 없어요</p>
            <Link href="/memo" className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-black">
              메모에서 별표로 고정하기
            </Link>
          </div>
        ) : currentMemo ? (
          <>
            <div className="absolute inset-0 overflow-hidden px-6 pt-6">
              <h3 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-neutral-900">
                {currentMemo.title?.trim() || "제목 없음"}
              </h3>
              <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-500">
                {currentMemo.content.trim() || "내용 없음"}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-6 pb-4">
              <span className="text-sm font-medium tracking-wide text-neutral-600">{formatCardDate(currentMemo.createdAt)}</span>
              <div className="flex items-center">
                {pinnedMemos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                      disabled={!canPrev}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label="이전 메모"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndex((i) => Math.min(pinnedMemos.length - 1, i + 1))}
                      disabled={!canNext}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label="다음 메모"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              <Link
                href="/memo"
                className="flex h-8 w-10 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="메모 페이지로 이동"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2.4" />
                  <circle cx="12" cy="12" r="2.4" />
                  <circle cx="19" cy="12" r="2.4" />
                </svg>
              </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-[280px] w-full flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
      style={{ backgroundColor: MEMO_HEADER_BG }}
    >
      {/* 헤더: 큰 박스에서 보이는 윗부분. 영문 날짜(왼쪽) + + 버튼(오른쪽) */}
      <div className="flex h-10 shrink-0 items-center justify-between px-5">
        <span className="text-sm font-medium" style={{ color: "#6A581E" }}>
          {formatHeaderDate()}
        </span>
        <Link
          href="/memo"
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-80"
          style={{ color: "#6A581E" }}
          aria-label="메모 페이지로 이동"
        >
          <span className="text-xl leading-none font-medium">+</span>
        </Link>
      </div>

      {/* 안쪽 흰 박스: 가로·아래 큰 박스와 딱 맞춤, 세로 최대한. 하단이 큰 박스에 겹쳐지도록 mb로 살짝 내림 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="relative -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white"
          style={{ boxShadow: "0 -4px 14px rgba(0,0,0,0.2)" }}
        >
          {pinnedMemos.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
              <p className="text-sm font-medium text-neutral-600">고정한 메모가 없어요</p>
              <Link
                href="/memo"
                className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-black"
              >
                메모에서 별표로 고정하기
              </Link>
            </div>
          ) : currentMemo ? (
            <>
              <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-5 pt-4 pb-12 scrollbar-hide">
                <h3 className="mb-2 text-base font-bold text-neutral-900">
                  {currentMemo.title?.trim() || "제목 없음"}
                </h3>
                <div
                  className="whitespace-pre-wrap break-words text-[15px] font-normal leading-relaxed text-neutral-700 md:text-[17px]"
                  style={{ lineHeight: "1.5" }}
                >
                  {currentMemo.content.trim() || "내용 없음"}
                </div>
              </div>

              {pinnedMemos.length > 1 && (
                <div className="absolute bottom-6 right-4 flex gap-0.5 z-10">
                  <button
                    type="button"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={!canPrev}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    aria-label="다음 메모"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
