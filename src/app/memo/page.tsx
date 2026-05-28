"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useMemoSearch } from "./MemoSearchContext";
import {
  type Memo,
  loadMemos,
  saveMemosOnlyUpdate,
  saveMemosKeepingTrash,
  createMemo,
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
  const isTrashView = selectedCategoryId === MEMO_CATEGORY_TRASH_ID;
  const isTrashViewRef = useRef(isTrashView);
  isTrashViewRef.current = isTrashView;
  const memosRef = useRef(memos);
  memosRef.current = memos;
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
    const normalized = raw.map((m, i) => ({
      ...m,
      x: m.x ?? 20 + (i % 4) * (MEMO_DEFAULT_WIDTH + gap),
      y: m.y ?? 20 + Math.floor(i / 4) * (MEMO_DEFAULT_HEIGHT + gap),
      width: m.width ?? MEMO_DEFAULT_WIDTH,
      height: m.height ?? MEMO_DEFAULT_HEIGHT,
    }));
    setMemos(normalized);
    const needsSave = raw.some((m, i) => m.x == null || m.y == null || m.width == null || m.height == null);
    if (needsSave) {
      const result = await saveMemosOnlyUpdate(normalized);
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
    const normalized = raw.map((m, i) => ({
      ...m,
      x: m.x ?? 20 + (i % 4) * (MEMO_DEFAULT_WIDTH + gap),
      y: m.y ?? 20 + Math.floor(i / 4) * (MEMO_DEFAULT_HEIGHT + gap),
      width: m.width ?? MEMO_DEFAULT_WIDTH,
      height: m.height ?? MEMO_DEFAULT_HEIGHT,
    }));
    setTrashMemos(normalized);
    setTrashCount(normalized.length);
    return normalized;
  }, []);

  useEffect(() => {
    load();
    loadMemoCategories().then((cats) => {
      setCategories(cats);
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
        cats.map((c) => c.id)
      );
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

  const addMemo = () => {
    if (isTrashView) return;
    const newMemo = createMemo("black", categoryIdForNewMemo);
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
    void persist([newMemo, ...memos]);
  };

  const updateMemo = (
    id: string,
    updates: Partial<
      Pick<Memo, "content" | "title" | "color" | "pinned" | "pinnedAt" | "x" | "y" | "width" | "height" | "collapsed" | "categoryId">
    >
  ) => {
    if (isTrashViewRef.current) {
      setTrashMemos((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
        void saveMemos([...memosRef.current, ...next]).then((r) => {
          if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
          else setSyncError(null);
        });
        return next;
      });
      return;
    }
    void persist(memos.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const deleteMemo = async (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (memo?.pinned && !window.confirm("고정된 메모를 휴지통으로 보낼까요?")) return;
    await moveMemoToTrash(id);
    await load();
    setTrashCount((c) => c + 1);
  };

  /** 검색어 있으면 제목·내용 기준 필터 후, 핀한 메모 먼저·최신순 정렬. 드래그/리사이즈 중인 카드는 맨 앞에 */
  const handleSelectCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
    setSelectedMemoCategoryId(id);
  }, []);

  const handleAddCategory = useCallback(async () => {
    const name = window.prompt("새 카테고리 이름");
    if (!name?.trim()) return;
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const next = [...categories, { id: generateMemoCategoryId(), name: name.trim(), sortOrder: maxOrder + 1 }];
    setCategories(next);
    await saveMemoCategories(next);
    handleSelectCategory(next[next.length - 1]!.id);
  }, [categories, handleSelectCategory]);

  const handleRenameCategory = useCallback(
    async (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      const name = window.prompt("카테고리 이름", cat.name);
      if (!name?.trim() || name.trim() === cat.name) return;
      const next = categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c));
      setCategories(next);
      await saveMemoCategories(next);
    },
    [categories]
  );

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      if (categories.length <= 1) {
        window.alert("카테고리는 최소 1개는 있어야 해요.");
        return;
      }
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      const fallback = categories.find((c) => c.id !== id)?.id ?? getDefaultMemoCategoryId();
      if (!window.confirm(`「${cat.name}」 카테고리를 삭제할까요?\n안의 메모는 다른 카테고리로 옮겨요.`)) return;
      const nextCats = categories.filter((c) => c.id !== id);
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
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (bPin !== aPin) return bPin - aPin;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [memos, trashMemos, isTrashView, searchQ, draggingId, resizingId, selectedCategoryId]);

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
        if (trash) {
          setTrashMemos((prev) => {
            const next = prev.map((m) => (m.id === draggingId ? { ...m, x, y } : m));
            void saveMemos([...memosRef.current, ...next]).then((r) => {
              if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
              else setSyncError(null);
            });
            return next;
          });
        } else {
          setMemos((prev) => {
            const next = prev.map((m) => (m.id === draggingId ? { ...m, x, y } : m));
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
        if (trash) {
          setTrashMemos((prev) => {
            const next = prev.map((m) => (m.id === resizingId ? { ...m, width, height } : m));
            void saveMemos([...memosRef.current, ...next]).then((r) => {
              if (!r.ok) setSyncError(`서버 저장 실패: ${r.message}`);
              else setSyncError(null);
            });
            return next;
          });
        } else {
          setMemos((prev) => {
            const next = prev.map((m) => (m.id === resizingId ? { ...m, width, height } : m));
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
        selectedId={selectedCategoryId}
        trashCount={trashCount}
        onSelect={handleSelectCategory}
        onAddCategory={() => void handleAddCategory()}
        onRenameCategory={(id) => void handleRenameCategory(id)}
        onDeleteCategory={(id) => void handleDeleteCategory(id)}
        onEmptyTrash={() => void handleEmptyTrash()}
        rightContent={
          !isTrashView ? (
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
          ) : null
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
                if (!isDesktop) return;
                if (!(e.target as HTMLElement).closest("[data-memo-drag-handle]")) return;
                if ((e.target as HTMLElement).closest("button")) return;
                if ((e.target as HTMLElement).closest("input")) return;
                if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
                e.preventDefault();
                dragPendingRef.current = {
                  id: memo.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  memoX: mx,
                  memoY: my,
                };
              }}
              className={`flex min-h-[280px] w-full cursor-default flex-col overflow-hidden rounded-xl transition-shadow md:absolute md:min-h-0 md:w-auto ${
                isCollapsed ? "" : "shadow-lg"
              } ${isDragging || isResizing ? "z-50 select-none" : "z-10"}`}
              style={{
                ...(isDesktop ? { left: mx, top: my, width: mw, height: wrapHeight } : {}),
                ...(isCollapsed ? {} : { boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }),
              }}
            >
              <MemoCard
                memo={memo}
                variant="full"
                className="h-full min-h-0 w-full"
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
    </div>
  );
}
