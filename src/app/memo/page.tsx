"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
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
  MEMO_DEFAULT_WIDTH,
  MEMO_DEFAULT_HEIGHT,
  MEMO_MIN_WIDTH,
  MEMO_MIN_HEIGHT,
} from "@/lib/memoDb";
import { MemoCard } from "@/components/memo/MemoCard";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function formatMemoDate(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY[d.getDay()];
  return `${m}.${day}(${w})`;
}

export default function MemoPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [colorMenuId, setColorMenuId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashMemos, setTrashMemos] = useState<Memo[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
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
    if (needsSave) await saveMemosOnlyUpdate(normalized);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTrashMemos().then((list) => setTrashCount(list.length));
  }, [trashOpen, memos.length]);

  const persist = useCallback(async (next: Memo[]) => {
    setMemos(next);
    await saveMemosKeepingTrash(next);
  }, []);

  const addMemo = () => {
    const newMemo = createMemo();
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
    updates: Partial<Pick<Memo, "content" | "title" | "color" | "pinned" | "pinnedAt" | "x" | "y" | "width" | "height" | "collapsed">>
  ) => {
    void persist(
      memos.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const deleteMemo = async (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (memo?.pinned && !window.confirm("고정된 메모를 휴지통으로 보낼까요?")) return;
    await moveMemoToTrash(id);
    await load();
    setTrashCount((c) => c + 1);
  };

  /** 핀한 메모 먼저, 그 다음 최신순. 드래그/리사이즈 중인 카드는 맨 앞(위)에 */
  const sortedMemos = useMemo(() => {
    return [...memos].sort((a, b) => {
      if (a.id === draggingId || a.id === resizingId) return 1;
      if (b.id === draggingId || b.id === resizingId) return -1;
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (bPin !== aPin) return bPin - aPin;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [memos, draggingId, resizingId]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (draggingId && dragStartRef.current) {
        const { startX, startY, memoX, memoY } = dragStartRef.current;
        let x = memoX + (e.clientX - startX);
        let y = memoY + (e.clientY - startY);
        x = Math.max(0, x);
        y = Math.max(0, y);
        dragStartRef.current.x = x;
        dragStartRef.current.y = y;
        setMemos((prev) =>
          prev.map((m) => (m.id === draggingId ? { ...m, x, y } : m))
        );
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
          setMemos((prev) =>
            prev.map((m) => (m.id === p.id ? { ...m, x, y } : m))
          );
        }
      } else if (resizingId && resizeStartRef.current) {
        const { startX, startY, w, h } = resizeStartRef.current;
        let width = Math.max(MEMO_MIN_WIDTH, w + (e.clientX - startX));
        let height = Math.max(MEMO_MIN_HEIGHT, h + (e.clientY - startY));
        resizeStartRef.current.x = width;
        resizeStartRef.current.y = height;
        setMemos((prev) =>
          prev.map((m) =>
            m.id === resizingId ? { ...m, width, height } : m
          )
        );
      }
    };
    const onPointerUp = () => {
      dragPendingRef.current = null;
      if (draggingId && dragStartRef.current) {
        const { x, y } = dragStartRef.current;
        setMemos((prev) => {
          const next = prev.map((m) =>
            m.id === draggingId ? { ...m, x, y } : m
          );
          void saveMemosKeepingTrash(next);
          return next;
        });
        dragStartRef.current = null;
        setDraggingId(null);
      } else if (resizingId && resizeStartRef.current) {
        const { x: width, y: height } = resizeStartRef.current;
        setMemos((prev) => {
          const next = prev.map((m) =>
            m.id === resizingId ? { ...m, width, height } : m
          );
          void saveMemosKeepingTrash(next);
          return next;
        });
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
    <div className="min-h-[180vh] min-w-0 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle
          title="메모"
          subtitle="포스트잇처럼 메모를 추가하고 관리해요."
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const next = !trashOpen;
              setTrashOpen(next);
              if (next) {
                const list = await loadTrashMemos();
                setTrashMemos(list);
                setTrashCount(list.length);
              }
            }}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
            title="휴지통"
          >
            휴지통{trashCount > 0 ? ` (${trashCount})` : ""}
          </button>
          <button
            type="button"
            onClick={addMemo}
            className="rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            + 메모 추가
          </button>
        </div>
      </div>

      {trashOpen && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-700">휴지통</h3>
            <button
              type="button"
              onClick={() => setTrashOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-200"
            >
              닫기
            </button>
          </div>
          {trashMemos.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-500">휴지통이 비어 있어요.</p>
          ) : (
            <ul className="space-y-2">
              {trashMemos.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                    {m.title || "(제목 없음)"}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {m.deletedAt ? formatMemoDate(m.deletedAt) : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await restoreMemo(m.id);
                        await load();
                        const list = await loadTrashMemos();
                        setTrashMemos(list);
                        setTrashCount(list.length);
                      }}
                      className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                      복원
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm("이 메모를 완전히 삭제할까요? 복원할 수 없어요.")) {
                          await permanentDeleteMemo(m.id);
                          const list = await loadTrashMemos();
                          setTrashMemos(list);
                          setTrashCount(list.length);
                        }
                      }}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      완전 삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
                updateMemo={updateMemo}
                deleteMemo={deleteMemo}
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

      {memos.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-16 text-center text-neutral-500">
          <p className="font-medium">메모가 없어요.</p>
          <p className="mt-1 text-sm">우측 상단 &quot;메모 추가&quot;로 추가해 보세요.</p>
          <button
            type="button"
            onClick={addMemo}
            className="mt-4 rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            + 메모 추가
          </button>
        </div>
      )}
    </div>
  );
}
