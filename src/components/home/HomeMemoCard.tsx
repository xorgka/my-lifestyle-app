"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { loadMemos, type Memo } from "@/lib/memoDb";
import { isMemoContentEmpty, memoContentToHtml } from "@/lib/memoContent";
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

/** 본문 HTML (예전 텍스트 메모도 줄바꿈 유지). 비어 있으면 안내 문구 */
function memoBodyHtml(content: string): string {
  return isMemoContentEmpty(content) ? "내용 없음" : memoContentToHtml(content);
}

export function HomeMemoCard() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [index, setIndex] = useState(0);
  const [cardStyle, setCardStyle] = useState<MemoCardStyle>("classic");
  const [expanded, setExpanded] = useState(false);

  // 확대 모달: Esc로 닫기, 좌우 화살표 키로 이전/다음 메모
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(memos.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, memos.length]);

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

  if (cardStyle === "tasks") {
    return (
      <div
        className="relative flex h-[280px] w-full flex-shrink-0 flex-col overflow-hidden rounded-3xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
        style={{ backgroundColor: "#FCDA55" }}
      >
        <div className="relative z-10 mx-3 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-white px-5 pt-4 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
          {currentMemo ? (
            <>
              <h3 className="mb-2 truncate text-xl font-extrabold text-neutral-900">{currentMemo.title?.trim() || "제목 없음"}</h3>
              <div
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words pb-4 text-[15px] font-normal leading-relaxed text-neutral-700 scrollbar-hide md:text-[17px]"
                style={{ lineHeight: "1.5" }}
                dangerouslySetInnerHTML={{ __html: memoBodyHtml(currentMemo.content) }}
              />
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-neutral-600">고정한 메모가 없어요</p>
              <Link href="/memo" className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-black">
                메모에서 별표로 고정하기
              </Link>
            </div>
          )}
        </div>
        <div className="flex h-12 shrink-0 items-center justify-between px-6" style={{ color: "#3D3306" }}>
          <Link href="/memo" className="text-xs font-bold hover:opacity-80" style={{ color: "#A38A3C" }}>
            MEMO
          </Link>
          {pinnedMemos.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-30"
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
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-30"
                aria-label="다음 메모"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (cardStyle === "card") {
    return (
      <>
        <div
          role={currentMemo ? "button" : undefined}
          tabIndex={currentMemo ? 0 : undefined}
          onClick={() => currentMemo && setExpanded(true)}
          onKeyDown={(e) => {
            if (currentMemo && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setExpanded(true);
            }
          }}
          className={`relative flex h-[280px] w-full flex-shrink-0 flex-col overflow-hidden rounded-3xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] ${currentMemo ? "cursor-pointer" : ""}`}
          style={{ backgroundColor: "#FCDA55" }}
        >
          {pinnedMemos.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
              <p className="text-sm font-medium text-neutral-700">고정한 메모가 없어요</p>
              <Link href="/memo" className="text-sm font-medium text-neutral-800 underline underline-offset-2 hover:text-black">
                메모에서 별표로 고정하기
              </Link>
            </div>
          ) : currentMemo ? (
            <>
              <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-6 pb-16 pt-6 scrollbar-hide">
                <h3 className="mb-3 border-b border-dashed border-black/15 pb-3 text-2xl font-extrabold leading-tight tracking-tight text-neutral-900/80">
                  {currentMemo.title?.trim() || "제목 없음"}
                </h3>
                <div
                  className="whitespace-pre-wrap break-words text-base leading-relaxed text-neutral-800"
                  dangerouslySetInnerHTML={{ __html: memoBodyHtml(currentMemo.content) }}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t" style={{ backgroundImage: "linear-gradient(to top, #FCDA55, rgba(252,218,85,0.9), transparent)" }} />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end px-6 pb-4">
                <div className="flex items-center">
                  {pinnedMemos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndex((i) => Math.max(0, i - 1));
                        }}
                        disabled={!canPrev}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-black/5 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="이전 메모"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndex((i) => Math.min(pinnedMemos.length - 1, i + 1));
                        }}
                        disabled={!canNext}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-black/5 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent"
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
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-10 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-black/5 hover:text-neutral-900"
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

        {expanded &&
          currentMemo &&
          createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center gap-3 overflow-y-auto bg-black/60 p-6 backdrop-blur-sm md:gap-5"
              onClick={() => setExpanded(false)}
            >
              {pinnedMemos.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => Math.max(0, i - 1));
                  }}
                  disabled={!canPrev}
                  className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-30"
                  aria-label="이전 메모"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="relative flex w-full max-w-sm flex-shrink-0 flex-col overflow-hidden rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                style={{ backgroundColor: "#FCDA55" }}
              >
                <Link
                  href="/memo"
                  onClick={() => setExpanded(false)}
                  className="absolute right-4 top-4 z-10 flex h-9 w-10 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-black/10 hover:text-neutral-900"
                  aria-label="메모 페이지로 이동"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="2.4" />
                    <circle cx="12" cy="12" r="2.4" />
                    <circle cx="19" cy="12" r="2.4" />
                  </svg>
                </Link>
                <div className="px-7 pb-7 pt-9">
                  <h3 className="mb-4 border-b border-dashed border-black/15 pb-4 pr-10 text-2xl font-extrabold leading-tight tracking-tight text-neutral-900/80">
                    {currentMemo.title?.trim() || "제목 없음"}
                  </h3>
                  <div
                    className="whitespace-pre-wrap break-words text-lg leading-relaxed text-neutral-800"
                    dangerouslySetInnerHTML={{ __html: memoBodyHtml(currentMemo.content) }}
                  />
                </div>
              </div>

              {pinnedMemos.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => Math.min(pinnedMemos.length - 1, i + 1));
                  }}
                  disabled={!canNext}
                  className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-30"
                  aria-label="다음 메모"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <div
      className="relative flex h-[280px] w-full flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
      style={{ backgroundColor: MEMO_HEADER_BG }}
    >
      {/* 헤더: 큰 박스에서 보이는 윗부분. 영문 날짜(왼쪽) + + 버튼(오른쪽) */}
      <div className="flex h-10 shrink-0 items-center justify-between px-5">
        <span className="min-w-0 flex-1 truncate pr-2 text-base font-bold" style={{ color: "#6A581E" }}>
          {currentMemo ? currentMemo.title?.trim() || "제목 없음" : formatHeaderDate()}
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
                <div
                  className="whitespace-pre-wrap break-words text-[15px] font-normal leading-relaxed text-neutral-700 md:text-[17px]"
                  style={{ lineHeight: "1.5" }}
                  dangerouslySetInnerHTML={{ __html: memoBodyHtml(currentMemo.content) }}
                />
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
