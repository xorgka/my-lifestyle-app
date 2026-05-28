"use client";

import type { MouseEvent, ReactNode } from "react";
import type { MemoCategory } from "@/lib/memoCategoryDb";
import { MEMO_CATEGORY_TRASH_ID } from "@/lib/memoCategoryDb";

type MemoCategoryBarProps = {
  /** sortOrder 순 (선택 시 맨 앞으로 저장됨) */
  categories: MemoCategory[];
  selectedId: string;
  trashCount: number;
  onSelect: (id: string) => void;
  onAddCategory: () => void;
  onRenameCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onEmptyTrash: () => void;
  rightContent?: ReactNode;
};

export function MemoCategoryBar({
  categories,
  selectedId,
  trashCount,
  onSelect,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onEmptyTrash,
  rightContent,
}: MemoCategoryBarProps) {
  const handleCategoryContext = (e: MouseEvent, catId: string) => {
    e.preventDefault();
    const action = window.prompt(
      "카테고리 관리\n1 = 이름 바꾸기\n2 = 삭제 (메모는 다른 카테고리로 이동)\n\n번호 입력:",
      "1"
    );
    if (action === "1") onRenameCategory(catId);
    else if (action === "2") onDeleteCategory(catId);
  };

  const handleTrashContext = (e: MouseEvent) => {
    e.preventDefault();
    if (trashCount === 0) {
      window.alert("휴지통이 비어 있어요.");
      return;
    }
    if (window.confirm(`휴지통 메모 ${trashCount}개를 모두 완전히 삭제할까요? 복원할 수 없어요.`)) {
      onEmptyTrash();
    }
  };

  const trashSelected = selectedId === MEMO_CATEGORY_TRASH_ID;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 pt-1 pl-3 pr-3 sm:pl-4 sm:pr-4 md:pl-6 md:pr-6">
      <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="메모 카테고리">
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
          onClick={() => onSelect(MEMO_CATEGORY_TRASH_ID)}
          onContextMenu={handleTrashContext}
          title="클릭: 휴지통 보기 · 우클릭: 휴지통 비우기"
          className={`relative min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium transition sm:min-h-0 ${
            trashSelected
              ? "bg-neutral-800 text-white"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          휴지통
          {trashCount > 0 && (
            <span
              className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                trashSelected ? "bg-white/25 text-white" : "bg-amber-500 text-white"
              }`}
            >
              {trashCount > 99 ? "99+" : trashCount}
            </span>
          )}
        </button>
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
