"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { anchorContextMenuPosition } from "@/lib/contextMenuPosition";
import { useMemoSearch } from "./MemoSearchContext";
import {
  type Memo,
  loadMemos,
  saveMemosOnlyUpdate,
  saveMemosKeepingTrash,
  createMemo,
  assignMissingMemoStackOrders,
  bringMemoToFrontInList,
  nextMemoStackOrder,
  loadTrashMemos,
  moveMemoToTrash,
  restoreMemo,
  permanentDeleteMemo,
  emptyTrashMemos,
  saveMemos,
  MEMO_DEFAULT_WIDTH,
  MEMO_DEFAULT_HEIGHT,
  MEMO_MIN_WIDTH,
  MEMO_MIN_HEIGHT,
} from "@/lib/memoDb";
import { MemoCard } from "@/components/memo/MemoCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { MemoCategoryBar } from "./MemoCategoryBar";
import { MemoSiblingNav } from "./MemoSiblingNav";
import {
  type MemoCategory,
  loadMemoCategories,
  saveMemoCategories,
  generateMemoCategoryId,
  setSelectedMemoCategoryId,
  MEMO_CATEGORY_TRASH_ID,
  getDefaultMemoCategoryId,
  resolveSelectedMemoCategoryId,
  sortMemoCategories,
  moveMemoCategoryOrder,
} from "@/lib/memoCategoryDb";

export default function MemoPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [colorMenuId, setColorMenuId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [trashMemos, setTrashMemos] = useState<Memo[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  /** Supabase 저장 실패 시: 이 브라우저 localStorage에만 있어 다른 기기에 안 보일 수 있음 */
  const [syncError, setSyncError] = useState<string | null>(null);
  const [categories, setCategories] = useState<MemoCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(getDefaultMemoCategoryId());
  const [trashContextMenu, setTrashContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const isTrashView = selectedCategoryId === MEMO_CATEGORY_TRASH_ID;
  const isTrashViewRef = useRef(isTrashView);
  isTrashViewRef.current = isTrashView;
  const memosRef = useRef(memos);
  memosRef.current = memos;
  const bringMemoToFrontRef = useRef<(id: string, options?: { persist?: boolean }) => void>(() => {});
  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  const { searchQ: rawSearchQ } = useMemoSearch();
  const searchQ = rawSearchQ.trim().toLowerCase();
  const dragStartRef = useRef<{ startX: number; startY: number; memoX: number; memoY: number; x: number; y: number } | null>(null);
  const dragPendingRef = useRef<{ id: string; startX: number; startY: number; memoX: number; memoY: number } | null>(null);
  const resizeStartRef = useRef<{ startX: number; startY: number; w: number; h: number; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const DRAG_THRESHOLD = 6;

  const load = useCallback(async () => {
    const raw = await loadMemos();
    const gap = 20;
    const withLayout = raw.map((m, i) => ({
      ...m,
      x: m.x ?? 20 + (i % 4) * (MEMO_DEFAULT_WIDTH + gap),
      y: m.y ?? 20 + Math.floor(i / 4) * (MEMO_DEFAULT_HEIGHT + gap),
      width: m.width ?? MEMO_DEFAULT_WIDTH,
      height: m.height ?? MEMO_DEFAULT_HEIGHT,
    }));
    const stacked = assignMissingMemoStackOrders(withLayout);
    setMemos(stacked.memos);
    const needsPosSave = raw.some((m) => m.x == null || m.y == null || m.width == null || m.height == null);
    if (needsPosSave || stacked.changed) {
      const result = await saveMemosOnlyUpdate(stacked.memos);
      if (!result.ok) {
        setSyncError(
          `메모 위치·크기를 서버에 저장하지 못했습니다. (${result.message})`
        );
      }
    }
  }, []);

  const refreshTrash = useCallback(async () => {
    const raw = await loadTrashMemos();
    const gap = 20;
    const withLayout = raw.map((m, i) => ({
      ...m,
      x: m.x ?? 20 + (i % 4) * (MEMO_DEFAULT_WIDTH + gap),
      y: m.y ?? 20 + Math.floor(i / 4) * (MEMO_DEFAULT_HEIGHT + gap),
      width: m.width ?? MEMO_DEFAULT_WIDTH,
      height: m.height ?? MEMO_DEFAULT_HEIGHT,
    }));
    const stacked = assignMissingMemoStackOrders(withLayout);
    setTrashMemos(stacked.memos);
    setTrashCount(stacked.memos.length);
    return stacked.memos;
  }, []);

  useEffect(() => {
    load();
    loadMemoCategories().then((cats) => {
      let list = sortMemoCategories(cats);
      let stored = getDefaultMemoCategoryId();
      if (typeof window !== "undefined") {
        try {
          stored = window.localStorage.getItem("memo-selected-category-id") ?? stored;
        } catch {
          /* ignore */
        }
      }
      const resolved = resolveSelectedMemoCategoryId(
        stored,
        list.map((c) => c.id)
      );
      setCategories(list);
      setSelectedCategoryId(resolved);
      setSelectedMemoCategoryId(resolved);
    });
    void refreshTrash();
  }, [load, refreshTrash]);

  const persist = useCallback(async (next: Memo[]) => {
    setMemos(next);
    const result = await saveMemosKeepingTrash(next);
    if (!result.ok) {
      setSyncError(
        `서버에 저장되지 않았습니다. 다른 기기와 맞지 않을 수 있어요. 원인: ${result.message}`
      );
    } else {
      setSyncError(null);
    }
  }, []);

  const categoryIdForNewMemo = isTrashView ? getDefaultMemoCategoryId() : selectedCategoryId;

  const persistTrash = useCallback(
    async (nextTrash: Memo[]) => {
      setTrashMemos(nextTrash);
      const result = await saveMemos([...memosRef.current, ...nextTrash]);
      if (!result.ok) {
        setSyncError(`서버에 저장되지 않았습니다. 원인: ${result.message}`);
      } else {
        setSyncError(null);
      }
      setTrashCount(nextTrash.length);
    },
    []
  );

  const bringMemoToFront = useCallback(
    (id: string, options?: { persist?: boolean }) => {
      const shouldPersist = options?.persist !== false;
      if (isTrashViewRef.current) {
        setTrashMemos((prev) => {
          const next = bringMemoToFrontInList(prev, id);
          if (next === prev) return prev;
          if (shouldPersist) void persistTrash(next);
          return next;
        });
        return;
      }
      setMemos((prev) => {
        const next = bringMemoToFrontInList(prev, id);
        if (next === prev) return prev;
        if (shouldPersist) void persist(next);
        return next;
      });
    },
    [persist, persistTrash]
  );
  bringMemoToFrontRef.current = bringMemoToFront;

  const addMemo = () => {
    if (isTrashView) return;
    const newMemo = createMemo("black", categoryIdForNewMemo);
    newMemo.stackOrder = nextMemoStackOrder(memos);
    newMemo.width = MEMO_DEFAULT_WIDTH;
    newMemo.height = MEMO_DEFAULT_HEIGHT;
    if (isDesktop && typeof window !== "undefined" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const viewportCenterX = window.innerWidth / 2 - rect.left - MEMO_DEFAULT_WIDTH / 2;
      const viewportCenterY = window.innerHeight / 2 - rect.top - MEMO_DEFAULT_HEIGHT / 2;
      newMemo.x = Math.max(0, Math.round(viewportCenterX));
      newMemo.y = Math.max(0, Math.round(viewportCenterY));
    } else {
      const gap = 20;
      const maxX = Math.max(0, ...memos.map((m) => (m.x ?? 20) + (m.width ?? MEMO_DEFAULT_WIDTH)));
      newMemo.x = maxX + gap;
      newMemo.y = 20;
    }
    void persist([...memos, newMemo]);
  };

  const updateMemo = (
    id: string,
    updates: Partial<
      Pick<Memo, "content" | "title" | "color" | "pinned" | "pinnedAt" | "x" | "y" | "width" | "height" | "collapsed" | "categoryId" | "stackOrder">
    >
  ) => {
    const bumpStack =
      updates.content !== undefined ||
      updates.title !== undefined ||
      updates.color !== undefined ||
      updates.categoryId !== undefined ||
      updates.collapsed !== undefined;

    if (isTrashViewRef.current) {
      setTrashMemos((prev) => {
        let next = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
        if (bumpStack) next = bringMemoToFrontInList(next, id);
        void saveMemos([...memosRef.current, ...next]).then((r) => {
          if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
          else setSyncError(null);
        });
        return next;
      });
      return;
    }
    let next = memos.map((m) => (m.id === id ? { ...m, ...updates } : m));
    if (bumpStack) next = bringMemoToFrontInList(next, id);
    void persist(next);
  };

  const deleteMemo = async (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (memo?.pinned && !window.confirm("고정된 메모를 휴지통으로 보낼까요?")) return;
    await moveMemoToTrash(id);
    await load();
    setTrashCount((c) => c + 1);
  };

  /** 검색 필터 후 stackOrder 오름차순(큰 값이 DOM 뒤 = 위). 드래그/리사이즈 중인 카드는 맨 앞 */
  const handleSelectCategory = useCallback(
    async (id: string) => {
      setSelectedCategoryId(id);
      setSelectedMemoCategoryId(id);
      if (id === MEMO_CATEGORY_TRASH_ID) {
        await refreshTrash();
      }
    },
    [refreshTrash]
  );

  const handleAddCategory = useCallback(async () => {
    const name = window.prompt("새 카테고리 이름");
    if (!name?.trim()) return;
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const newId = generateMemoCategoryId();
    const next = sortMemoCategories([
      ...categories,
      { id: newId, name: name.trim(), sortOrder: maxOrder + 1 },
    ]);
    setCategories(next);
    await saveMemoCategories(next);
    setSelectedCategoryId(newId);
    setSelectedMemoCategoryId(newId);
  }, [categories, handleSelectCategory]);

  const handleRenameCategory = useCallback(
    async (id: string, name: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      const trimmed = name.trim();
      if (!trimmed || trimmed === cat.name) return;
      const next = sortMemoCategories(
        categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
      );
      setCategories(next);
      await saveMemoCategories(next);
    },
    [categories]
  );

  const handleMoveCategoryOrder = useCallback(
    async (id: string, direction: "earlier" | "later") => {
      const next = moveMemoCategoryOrder(categories, id, direction);
      if (!next) return;
      setCategories(next);
      await saveMemoCategories(next);
    },
    [categories]
  );

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      if (categories.length <= 1) return;
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      const fallback = categories.find((c) => c.id !== id)?.id ?? getDefaultMemoCategoryId();
      const nextCats = sortMemoCategories(categories.filter((c) => c.id !== id)).map((c, i) => ({
        ...c,
        sortOrder: i,
      }));
      const nextMemos = memos.map((m) =>
        m.categoryId === id ? { ...m, categoryId: fallback } : m
      );
      setCategories(nextCats);
      await saveMemoCategories(nextCats);
      await persist(nextMemos);
      if (selectedCategoryId === id) {
        handleSelectCategory(categories.find((c) => c.id !== id)?.id ?? getDefaultMemoCategoryId());
      }
    },
    [categories, memos, persist, selectedCategoryId, handleSelectCategory]
  );

  const handleEmptyTrash = useCallback(async () => {
    await emptyTrashMemos();
    setTrashMemos([]);
    setTrashCount(0);
  }, []);

  const requestEmptyTrash = useCallback(async () => {
    if (trashCount === 0) {
      window.alert("휴지통이 이미 비어 있어요.");
      return;
    }
    if (
      !window.confirm(
        `휴지통의 메모 ${trashCount}개를 모두 완전히 삭제할까요?\n복원할 수 없어요.`
      )
    ) {
      return;
    }
    await handleEmptyTrash();
  }, [trashCount, handleEmptyTrash]);

  useEffect(() => {
    if (!trashContextMenu) return;
    const close = () => setTrashContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trashContextMenu]);

  const handleRestoreFromTrash = useCallback(
    async (id: string) => {
      await restoreMemo(id);
      await load();
      await refreshTrash();
    },
    [load, refreshTrash]
  );

  const handlePermanentDeleteFromTrash = useCallback(
    async (id: string) => {
      if (!window.confirm("이 메모를 완전히 삭제할까요? 복원할 수 없어요.")) return;
      await permanentDeleteMemo(id);
      await refreshTrash();
    },
    [refreshTrash]
  );

  const sortedMemos = useMemo(() => {
    let list = isTrashView
      ? trashMemos
      : memos.filter((m) => (m.categoryId ?? getDefaultMemoCategoryId()) === selectedCategoryId);
    if (searchQ) {
      list = list.filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(searchQ)) ||
          (m.content && m.content.toLowerCase().includes(searchQ))
      );
    }
    return [...list].sort((a, b) => {
      if (a.id === draggingId || a.id === resizingId) return 1;
      if (b.id === draggingId || b.id === resizingId) return -1;
      const diff = (a.stackOrder ?? 0) - (b.stackOrder ?? 0);
      return isDesktop ? diff : -diff;
    });
  }, [memos, trashMemos, isTrashView, searchQ, draggingId, resizingId, selectedCategoryId, isDesktop]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const trash = isTrashViewRef.current;
      const patchPos = (id: string, x: number, y: number) => {
        if (trash) {
          setTrashMemos((prev) => prev.map((m) => (m.id === id ? { ...m, x, y } : m)));
        } else {
          setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, x, y } : m)));
        }
      };
      const patchSize = (id: string, width: number, height: number) => {
        if (trash) {
          setTrashMemos((prev) => prev.map((m) => (m.id === id ? { ...m, width, height } : m)));
        } else {
          setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, width, height } : m)));
        }
      };

      if (draggingId && dragStartRef.current) {
        const { startX, startY, memoX, memoY } = dragStartRef.current;
        let x = memoX + (e.clientX - startX);
        let y = memoY + (e.clientY - startY);
        x = Math.max(0, x);
        y = Math.max(0, y);
        dragStartRef.current.x = x;
        dragStartRef.current.y = y;
        patchPos(draggingId, x, y);
      } else if (dragPendingRef.current && !draggingId) {
        const p = dragPendingRef.current;
        const dx = e.clientX - p.startX;
        const dy = e.clientY - p.startY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          setDraggingId(p.id);
          bringMemoToFrontRef.current(p.id, { persist: false });
          const x = Math.max(0, p.memoX + dx);
          const y = Math.max(0, p.memoY + dy);
          dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            memoX: p.memoX,
            memoY: p.memoY,
            x,
            y,
          };
          dragPendingRef.current = null;
          patchPos(p.id, x, y);
        }
      } else if (resizingId && resizeStartRef.current) {
        const { startX, startY, w, h } = resizeStartRef.current;
        const width = Math.max(MEMO_MIN_WIDTH, w + (e.clientX - startX));
        const height = Math.max(MEMO_MIN_HEIGHT, h + (e.clientY - startY));
        resizeStartRef.current.x = width;
        resizeStartRef.current.y = height;
        patchSize(resizingId, width, height);
      }
    };
    const onPointerUp = () => {
      dragPendingRef.current = null;
      const trash = isTrashViewRef.current;
      if (draggingId && dragStartRef.current) {
        const { x, y } = dragStartRef.current;
        const draggedId = draggingId;
        if (trash) {
          setTrashMemos((prev) => {
            let next = prev.map((m) => (m.id === draggedId ? { ...m, x, y } : m));
            if (draggedId) next = bringMemoToFrontInList(next, draggedId);
            void saveMemos([...memosRef.current, ...next]).then((r) => {
              if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
              else setSyncError(null);
            });
            return next;
          });
        } else {
          setMemos((prev) => {
            let next = prev.map((m) => (m.id === draggedId ? { ...m, x, y } : m));
            if (draggedId) next = bringMemoToFrontInList(next, draggedId);
            void saveMemosKeepingTrash(next).then((r) => {
              if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
              else setSyncError(null);
            });
            return next;
          });
        }
        dragStartRef.current = null;
        setDraggingId(null);
      } else if (resizingId && resizeStartRef.current) {
        const { x: width, y: height } = resizeStartRef.current;
        const resizedId = resizingId;
        if (trash) {
          setTrashMemos((prev) => {
            let next = prev.map((m) => (m.id === resizedId ? { ...m, width, height } : m));
            if (resizedId) next = bringMemoToFrontInList(next, resizedId);
            void saveMemos([...memosRef.current, ...next]).then((r) => {
              if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
              else setSyncError(null);
            });
            return next;
          });
        } else {
          setMemos((prev) => {
            let next = prev.map((m) => (m.id === resizedId ? { ...m, width, height } : m));
            if (resizedId) next = bringMemoToFrontInList(next, resizedId);
            void saveMemosKeepingTrash(next).then((r) => {
              if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
              else setSyncError(null);
            });
            return next;
          });
        }
        resizeStartRef.current = null;
        setResizingId(null);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [draggingId, resizingId]);

  return (
    <div className="min-h-[180vh] min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <SectionTitle
          title="메모"
          subtitle="포스트잇처럼 메모를 추가하고 관리해요."
        />
        <div className="mt-2 flex shrink-0 items-center gap-2 sm:mt-4">
          <MemoSiblingNav variant="on-memo" />
        </div>
      </div>

      {syncError && (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="min-w-0 flex-1 leading-relaxed">{syncError}</p>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="shrink-0 rounded-lg bg-amber-200/80 px-3 py-1 text-xs font-medium text-amber-950 hover:bg-amber-200"
          >
            닫기
          </button>
        </div>
      )}

      <MemoCategoryBar
        categories={categories}
        selectedId={isTrashView ? "" : selectedCategoryId}
        onSelect={handleSelectCategory}
        onAddCategory={() => void handleAddCategory()}
        onRenameCategory={(id, name) => void handleRenameCategory(id, name)}
        onMoveCategoryOrder={(id, dir) => void handleMoveCategoryOrder(id, dir)}
        onDeleteCategory={(id) => void handleDeleteCategory(id)}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSelectCategory(MEMO_CATEGORY_TRASH_ID)}
              onContextMenu={(e) => {
                e.preventDefault();
                const pos = anchorContextMenuPosition(
                  e.currentTarget.getBoundingClientRect(),
                  { width: 152, height: 48 }
                );
                setTrashContextMenu(pos);
              }}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
                isTrashView
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              }`}
              title="휴지통 · 우클릭: 전체 삭제"
              aria-label="휴지통"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {trashCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-medium text-white">
                  {trashCount > 99 ? "99+" : trashCount}
                </span>
              )}
            </button>
            {!isTrashView && (
              <button
                type="button"
                onClick={addMemo}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 text-white transition hover:bg-neutral-700"
                title="메모 추가"
                aria-label="메모 추가"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        }
      />

      <div
        ref={canvasRef}
        className="flex w-full flex-col gap-4 md:relative md:min-h-[calc(100vh-12rem)]"
        style={isDesktop ? { minHeight: 600 } : undefined}
      >
        {sortedMemos.map((memo) => {
          const mx = memo.x ?? 20;
          const my = memo.y ?? 20;
          const mw = memo.width ?? MEMO_DEFAULT_WIDTH;
          const mh = memo.height ?? MEMO_DEFAULT_HEIGHT;
          const isCollapsed = memo.collapsed === true;
          const isDragging = draggingId === memo.id;
          const isResizing = resizingId === memo.id;
          /** 접힌 상태: 헤더 높이만, wrapper 그림자 제거(카드만 그림자), 리사이즈 핸들 숨김 */
          const wrapHeight = isCollapsed ? 44 : mh;
          return (
            <div
              key={memo.id}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
                bringMemoToFront(memo.id);
                if (!isDesktop) return;
                if (!(e.target as HTMLElement).closest("[data-memo-drag-handle]")) return;
                if ((e.target as HTMLElement).closest("button")) return;
                if ((e.target as HTMLElement).closest("input")) return;
                e.preventDefault();
                dragPendingRef.current = {
                  id: memo.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  memoX: mx,
                  memoY: my,
                };
              }}
              className={`flex h-auto w-full cursor-default flex-col overflow-hidden rounded-xl transition-shadow md:absolute md:min-h-0 md:w-auto ${
                isCollapsed ? "" : "shadow-lg"
              } ${isDragging || isResizing ? "select-none" : ""}`}
              style={{
                ...(isDesktop ? { left: mx, top: my, width: mw, height: wrapHeight } : {}),
                ...(isCollapsed ? {} : { boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }),
                zIndex: isDragging || isResizing ? 100000 : (memo.stackOrder ?? 0) + 1,
              }}
            >
              <MemoCard
                memo={memo}
                variant="full"
                className={
                  isDesktop
                    ? "h-full min-h-0 w-full"
                    : "flex min-h-[300px] w-full flex-col"
                }
                categories={isTrashView ? undefined : categories}
                updateMemo={updateMemo}
                deleteMemo={isTrashView ? undefined : deleteMemo}
                trashMode={isTrashView}
                onRestore={isTrashView ? handleRestoreFromTrash : undefined}
                onPermanentDelete={isTrashView ? handlePermanentDeleteFromTrash : undefined}
                colorMenuId={colorMenuId}
                setColorMenuId={setColorMenuId}
                editingTitleId={editingTitleId}
                setEditingTitleId={setEditingTitleId}
                onMemoActivate={(id) => bringMemoToFront(id)}
              />
              {isDesktop && !isCollapsed && (
                <div
                  data-resize-handle
                  className="absolute bottom-0 right-0 z-10 h-8 w-8 cursor-se-resize"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    setResizingId(memo.id);
                    resizeStartRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      w: mw,
                      h: mh,
                      x: mw,
                      y: mh,
                    };
                  }}
                  aria-label="크기 조절"
                />
              )}
            </div>
          );
        })}
      </div>

      {!isTrashView && memos.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-16 text-center text-neutral-500">
          <p className="font-medium">메모가 없어요.</p>
          <p className="mt-1 text-sm">카테고리 줄 오른쪽 + 버튼으로 추가해 보세요.</p>
          <button
            type="button"
            onClick={addMemo}
            className="mt-4 rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            + 메모 추가
          </button>
        </div>
      )}
      {isTrashView && trashMemos.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-16 text-center text-neutral-500">
          <p className="font-medium">휴지통이 비어 있어요.</p>
        </div>
      )}
      {((!isTrashView && memos.length > 0) || (isTrashView && trashMemos.length > 0)) &&
        sortedMemos.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-16 text-center text-neutral-500">
          <p className="font-medium">
            {searchQ ? "검색 결과가 없어요." : isTrashView ? "휴지통에 해당 메모가 없어요." : "이 카테고리에 메모가 없어요."}
          </p>
          <p className="mt-1 text-sm">
            {searchQ
              ? "다른 검색어로 시도해 보세요."
              : isTrashView
                ? "다른 카테고리를 선택해 보세요."
                : "+ 로 메모를 추가하거나, 다른 카테고리를 선택해 보세요."}
          </p>
        </div>
      )}

      {trashContextMenu &&
        portalReady &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" aria-hidden onClick={() => setTrashContextMenu(null)} />
            <div
              className="fixed z-[61] min-w-[9.5rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
              style={{ left: trashContextMenu.x, top: trashContextMenu.y }}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                disabled={trashCount === 0}
                className="flex w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
                onClick={() => {
                  setTrashContextMenu(null);
                  void requestEmptyTrash();
                }}
              >
                전체 삭제
                {trashCount > 0 ? ` (${trashCount})` : ""}
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
