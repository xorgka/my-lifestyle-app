"use client";

import Link from "next/link";

const iconLinkClass =
  "flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-800 hover:bg-neutral-800 hover:text-white sm:h-14 sm:w-14 sm:min-h-0 sm:min-w-0";

type MemoSiblingNavProps = {
  /** 메모(포스트잇) 페이지면 노트로 가는 링크, 노트 페이지면 메모로 */
  variant: "on-memo" | "on-note";
};

export function MemoSiblingNav({ variant }: MemoSiblingNavProps) {
  if (variant === "on-memo") {
    return (
      <Link href="/memo/note" className={iconLinkClass} aria-label="노트" title="노트">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </Link>
    );
  }

  return (
    <Link href="/memo" className={iconLinkClass} aria-label="포스트잇 메모" title="포스트잇 메모">
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
    </Link>
  );
}
