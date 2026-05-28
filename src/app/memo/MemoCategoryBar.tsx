"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { MemoCategory } from "@/lib/memoCategoryDb";

type MemoCategoryBarProps = {
  /** sortOrder 순 (추가한 순서 유지) */
  categories: MemoCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddCategory: () => void;
  onRenameCategory: (id: string, name: string) => void;
  onMoveCategoryOrder: (id: string, direction: "earlier" | "later") => void;
  onDeleteCategory: (id: string) => void;
  /** 휴지통·메모 추가 등 — 카테고리 줄 오른쪽 */
  rightContent?: ReactNode;
};

export function MemoCategoryBar({
  categories,
  selectedId,
  onSelect,
  onAddCategory,
  onRenameCategory,
  onMoveCategoryOrder,
  onDeleteCategory,
  rightContent,
}: MemoCategoryBarProps) {
  const [contextMenu, setContextMenu] = useState<{ catId: string; x: number; y: number } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contextMenu]);

  const openContextMenu = (e: MouseEvent, catId: string) => {
    e.preventDefault();
    setContextMenu({ catId, x: e.clientX, y: e.clientY });
  };

  const menuCatId = contextMenu?.catId;
  const menuIndex = menuCatId ? categories.findIndex((c) => c.id === menuCatId) : -1;
  const canMoveEarlier = menuIndex > 0;
  const canMoveLater = menuIndex >= 0 && menuIndex < categories.length - 1;

  const submitRename = () => {
    if (!renameTarget) return;
    const trimmed = renameTarget.name.trim();
    if (!trimmed) return;
    onRenameCategory(renameTarget.id, trimmed);
    setRenameTarget(null);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 pt-1 pl-3 pr-3 sm:pl-4 sm:pr-4 md:pl-6 md:pr-6">
      <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="메모 카테고리">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            onContextMenu={(e) => openContextMenu(e, c.id)}
            title="우클릭: 이름·순서·삭제"
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-800"
          aria-label="카테고리 추가"
          title="카테고리 추가"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </nav>
      {rightContent != null ? (
        <div className="flex shrink-0 items-center gap-2">{rightContent}</div>
      ) : null}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" aria-hidden onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-[61] min-w-[10.5rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100"
              onClick={() => {
                const cat = categories.find((c) => c.id === contextMenu.catId);
                if (!cat) return;
                setRenameTarget({ id: cat.id, name: cat.name });
                setContextMenu(null);
              }}
            >
              이름 바꾸기
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveEarlier}
              className="flex w-full px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
              onClick={() => {
                onMoveCategoryOrder(contextMenu.catId, "earlier");
                setContextMenu(null);
              }}
            >
              순서 앞으로
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveLater}
              className="flex w-full px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
              onClick={() => {
                onMoveCategoryOrder(contextMenu.catId, "later");
                setContextMenu(null);
              }}
            >
              순서 뒤로
            </button>
            <div className="my-1 border-t border-neutral-100" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
              onClick={() => {
                const cat = categories.find((c) => c.id === contextMenu.catId);
                if (!cat) return;
                if (categories.length <= 1) {
                  setAlertMessage("카테고리는 최소 1개는 있어야 해요.");
                  setContextMenu(null);
                  return;
                }
                setDeleteTarget({ id: cat.id, name: cat.name });
                setContextMenu(null);
              }}
            >
              삭제
            </button>
          </div>
        </>
      )}

      {renameTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memo-category-rename-title"
          onClick={() => setRenameTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="memo-category-rename-title" className="text-base font-semibold text-neutral-900">
              카테고리 이름
            </h2>
            <input
              type="text"
              value={renameTarget.name}
              onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300/50"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!renameTarget.name.trim()}
                onClick={submitRename}
                className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`「${deleteTarget.name}」 카테고리를 삭제할까요?\n안의 메모는 다른 카테고리로 옮겨요.`}
          confirmLabel="삭제"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDeleteCategory(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}

      {alertMessage && (
        <ConfirmDialog
          message={alertMessage}
          confirmLabel="확인"
          cancelLabel="닫기"
          onCancel={() => setAlertMessage(null)}
          onConfirm={() => setAlertMessage(null)}
        />
      )}
    </div>
  );
}
