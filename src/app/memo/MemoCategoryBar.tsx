"use client";

import type { MouseEvent, ReactNode } from "react";
import type { MemoCategory } from "@/lib/memoCategoryDb";
import { MEMO_CATEGORY_ALL_ID } from "@/lib/memoCategoryDb";

type MemoCategoryBarProps = {
  categories: MemoCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddCategory: () => void;
  onRenameCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  rightContent?: ReactNode;
};

export function MemoCategoryBar({
  categories,
  selectedId,
  onSelect,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  rightContent,
}: MemoCategoryBarProps) {
  const handleCategoryContext = (e: MouseEvent, catId: string) => {
    if (catId === MEMO_CATEGORY_ALL_ID) return;
    e.preventDefault();
    const action = window.prompt(
      "카테고리 관리\n1 = 이름 바꾸기\n2 = 삭제 (메모는 다른 카테고리로 이동)\n\n번호 입력:",
      "1"
    );
    if (action === "1") onRenameCategory(catId);
    else if (action === "2") onDeleteCategory(catId);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 pt-1 pl-3 pr-3 sm:pl-4 sm:pr-4 md:pl-6 md:pr-6">
      <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="메모 카테고리">
        <button
          type="button"
          onClick={() => onSelect(MEMO_CATEGORY_ALL_ID)}
          className={`min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium transition sm:min-h-0 ${
            selectedId === MEMO_CATEGORY_ALL_ID
              ? "bg-neutral-800 text-white"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          전체
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            onContextMenu={(e) => handleCategoryContext(e, c.id)}
            title="우클릭: 이름 바꾸기·삭제"
            className={`min-h-[40px] max-w-[10rem] truncate rounded-lg px-3 py-2 text-sm font-medium transition sm:min-h-0 ${
              selectedId === c.id
                ? "bg-neutral-800 text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {c.name || "이름 없음"}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddCategory}
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-dashed border-neutral-300 text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-800 sm:min-h-0 sm:min-w-0"
          aria-label="카테고리 추가"
          title="카테고리 추가"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </nav>
      {rightContent != null ? (
        <div className="flex shrink-0 items-center gap-2">{rightContent}</div>
      ) : null}
    </div>
  );
}
