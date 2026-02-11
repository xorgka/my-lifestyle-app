"use client";

import { useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import type { Memo, MemoColorId } from "@/lib/memoDb";
import { MEMO_COLORS } from "@/lib/memoDb";

const EDIT_TITLE_DELAY_MS = 250;

type MemoCardProps = {
  memo: Memo;
  variant: "full" | "preview";
  className?: string;
  /** preview: 오른쪽 헤더에 표시 (예: 메모 페이지 링크) */
  headerRight?: ReactNode;
  /** preview: 설정 시 헤더 전체 클릭으로 해당 URL 이동 (홈용) */
  headerHref?: string;
  /** full only */
  updateMemo?: (id: string, updates: Partial<Pick<Memo, "content" | "title" | "color" | "pinned" | "pinnedAt" | "collapsed">>) => void;
  deleteMemo?: (id: string) => void;
  colorMenuId?: string | null;
  setColorMenuId?: (id: string | null) => void;
  editingTitleId?: string | null;
  setEditingTitleId?: (id: string | null) => void;
};

export function MemoCard({
  memo,
  variant,
  className = "",
  headerRight,
  headerHref,
  updateMemo,
  deleteMemo,
  colorMenuId,
  setColorMenuId,
  editingTitleId,
  setEditingTitleId,
}: MemoCardProps) {
  const colors = MEMO_COLORS[memo.color] ?? MEMO_COLORS.black;
  const isColorOpen = colorMenuId === memo.id;
  const isEditingTitle = editingTitleId === memo.id;
  const isCollapsed = variant === "full" && memo.collapsed === true;
  const editTitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearEditTitleSchedule = () => {
    if (editTitleTimeoutRef.current) {
      clearTimeout(editTitleTimeoutRef.current);
      editTitleTimeoutRef.current = null;
    }
  };
  useEffect(() => () => clearEditTitleSchedule(), []);

  const rootStyle = {
    backgroundColor: colors.bodyBg,
    borderColor: variant === "full" ? colors.border : "rgba(0,0,0,0.11)",
    ...(variant !== "preview" ? { boxShadow: "0 4px 14px rgba(0,0,0,0.08)" } : {}),
  };

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border ${
        variant === "preview"
          ? "shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
          : ""
      } ${className} ${isCollapsed ? "h-auto flex-shrink-0" : ""}`}
      style={rootStyle}
    >
      {/* 헤더 (preview+headerHref면 헤더 클릭 시 링크 이동) */}
      {variant === "preview" && headerHref ? (
        <Link
          href={headerHref}
          className="relative flex flex-shrink-0 select-none items-center justify-between gap-2 rounded-t-[10px] border-b px-4 py-2 no-underline cursor-pointer min-h-[2.5rem]"
          style={{
            backgroundColor: colors.headerBg,
            borderColor: colors.headerFg ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)",
            color: colors.headerFg ?? undefined,
          }}
          aria-label="메모 페이지로 이동"
        >
          <span className="flex min-w-0 flex-1 items-center">
            <span className="min-w-0 truncate text-[17px] font-semibold">
              {memo.title || "\u00A0"}
            </span>
          </span>
          <div className="-space-x-1 flex shrink-0 items-center">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded [&_svg]:size-4 ${memo.pinned ? "opacity-100" : "opacity-25"}`}
              style={{ color: memo.pinned ? "#fff" : (colors.headerFg ?? "currentColor") }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" fill={memo.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </span>
          </div>
        </Link>
      ) : (
        <div
          data-memo-drag-handle
          className={`relative flex flex-shrink-0 select-none items-center justify-between gap-2 rounded-t-[10px] px-4 py-1 ${variant === "full" ? "cursor-grab active:cursor-grabbing" : ""} ${isCollapsed ? "rounded-b-[10px] border-b-0" : "border-b"}`}
          style={{
            backgroundColor: colors.headerBg,
            borderColor: colors.headerFg ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)",
            color: colors.headerFg ?? undefined,
          }}
          onContextMenu={
            variant === "full" && setColorMenuId
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setColorMenuId(isColorOpen ? null : memo.id);
                }
              : undefined
          }
          onDoubleClick={
            variant === "full" && updateMemo
              ? (e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  clearEditTitleSchedule();
                  setEditingTitleId?.(null);
                  updateMemo(memo.id, { collapsed: !memo.collapsed });
                }
              : undefined
          }
        >
        <span className="flex min-w-0 flex-1 items-center">
          {variant === "full" && isEditingTitle && updateMemo ? (
            <input
              type="text"
              value={memo.title ?? ""}
              onChange={(e) => updateMemo(memo.id, { title: e.target.value })}
              onBlur={() => setEditingTitleId?.(null)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") setEditingTitleId?.(null);
              }}
              placeholder="제목"
              className="min-w-0 flex-1 rounded bg-transparent px-0 py-0 text-[17px] font-semibold outline-none placeholder:opacity-60"
              style={{ color: colors.headerFg ?? "inherit" }}
              autoFocus
            />
          ) : (
            <span
              className="min-w-0 truncate text-[17px] font-semibold cursor-text"
              onClick={
                variant === "full" && setEditingTitleId
                  ? (e) => {
                      e.stopPropagation();
                      clearEditTitleSchedule();
                      editTitleTimeoutRef.current = setTimeout(() => setEditingTitleId(memo.id), EDIT_TITLE_DELAY_MS);
                    }
                  : undefined
              }
              onDoubleClick={
                variant === "full"
                  ? (e) => {
                      e.stopPropagation();
                      clearEditTitleSchedule();
                    }
                  : undefined
              }
            >
              {memo.title || "\u00A0"}
            </span>
          )}
        </span>
        <div className="-space-x-1 flex shrink-0 items-center">
          {variant === "full" && updateMemo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateMemo(memo.id, {
                pinned: !memo.pinned,
                pinnedAt: memo.pinned ? undefined : new Date().toISOString(),
              });
              }}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded [&_svg]:size-4 ${memo.pinned ? "opacity-100" : "opacity-25 hover:opacity-100"}`}
              style={{ color: memo.pinned ? "#fff" : (colors.headerFg ?? "currentColor") }}
              aria-label={memo.pinned ? "고정 해제" : "상단 고정"}
              title={memo.pinned ? "고정 해제" : "상단 고정"}
            >
              <svg viewBox="0 0 24 24" fill={memo.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
          {variant === "preview" && (
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded [&_svg]:size-4 ${memo.pinned ? "opacity-100" : "opacity-25"}`}
              style={{ color: memo.pinned ? "#fff" : (colors.headerFg ?? "currentColor") }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" fill={memo.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </span>
          )}
          {variant === "preview" && headerRight != null && headerRight}
          {variant === "full" && isColorOpen && setColorMenuId && updateMemo && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={(e) => {
                  e.stopPropagation();
                  setColorMenuId(null);
                }}
              />
              <div className="absolute left-0 top-full z-20 mt-1.5 flex gap-1.5 rounded-xl bg-white px-2 py-2 shadow-lg ring-1 ring-neutral-100">
                {(Object.keys(MEMO_COLORS) as MemoColorId[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMemo(memo.id, { color: c });
                      setColorMenuId(null);
                    }}
                    className={`h-6 w-6 shrink-0 rounded-full transition hover:scale-110 ${memo.color === c ? "ring-2 ring-neutral-800 ring-offset-1" : ""}`}
                    style={{ backgroundColor: MEMO_COLORS[c].headerBg }}
                    title={MEMO_COLORS[c].label}
                  />
                ))}
              </div>
            </>
          )}
          {variant === "full" && deleteMemo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteMemo(memo.id);
              }}
              className="flex h-8 w-8 items-center justify-center rounded text-2xl font-light opacity-25 hover:opacity-100"
              style={{ color: colors.headerFg ?? "currentColor" }}
              aria-label="삭제"
              title="삭제"
            >
              ×
            </button>
          )}
        </div>
      </div>
      )}

      {/* 본문 (접힌 상태면 숨김. preview는 모바일에서 좌우 패딩 크게 → 화살표와 겹치지 않도록) */}
      {!isCollapsed && (
      <div className={`min-h-0 flex-1 overflow-hidden py-3 bg-white rounded-b-[10px] ${variant === "preview" ? "px-12 md:px-4" : "px-4"}`}>
        {variant === "full" && updateMemo ? (
          <textarea
            value={memo.content}
            onChange={(e) => updateMemo(memo.id, { content: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="메모를 입력하세요..."
            className="h-full min-h-0 w-full resize-none rounded border-0 bg-white p-0 text-[19px] text-neutral-800 placeholder:text-neutral-400 focus:ring-0 focus:outline-none"
            style={{ minHeight: 120 }}
          />
        ) : (
          <div className={`h-full min-h-0 overflow-y-auto overflow-x-hidden text-[19px] text-neutral-800 whitespace-pre-wrap break-words ${variant === "preview" ? "max-md:scrollbar-hide" : ""}`}>
            {memo.content.trim() || "내용 없음"}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
