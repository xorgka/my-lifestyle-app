"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoSearch } from "./MemoSearchContext";
import type { Note } from "@/lib/noteDb";

type MemoNoteTabsProps = {
  rightContent?: ReactNode;
  /** 노트 페이지에서만 전달: 검색 모달용 노트/휴지통 목록 */
  notesForSearch?: Note[];
  trashNotesForSearch?: Note[];
  onSelectNoteFromSearch?: (id: string) => void;
};

export function MemoNoteTabs({
  rightContent,
  notesForSearch = [],
  trashNotesForSearch = [],
  onSelectNoteFromSearch,
}: MemoNoteTabsProps) {
  const pathname = usePathname();
  const { searchQ: rawQ, setSearchQ } = useMemoSearch();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const isMemo = pathname === "/memo" || pathname === "/memo/";
  const isNotePage = pathname === "/memo/note" && typeof onSelectNoteFromSearch === "function";

  const q = rawQ.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q || !isNotePage) return [];
    const all: { note: Note; isTrash: boolean }[] = [
      ...notesForSearch.map((note) => ({ note, isTrash: false })),
      ...trashNotesForSearch.map((note) => ({ note, isTrash: true })),
    ];
    return all.filter(
      (x) =>
        (x.note.title && x.note.title.toLowerCase().includes(q)) ||
        (x.note.content && x.note.content.toLowerCase().includes(q))
    );
  }, [q, isNotePage, notesForSearch, trashNotesForSearch]);

  useEffect(() => {
    if (!searchModalOpen) return;
    const close = (e: MouseEvent) => {
      if (searchWrapRef.current?.contains(e.target as Node)) return;
      setSearchModalOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [searchModalOpen]);

  const openSearchModal = () => {
    if (rawQ.trim() && isNotePage) setSearchModalOpen(true);
  };

  const handleSelectNote = (id: string) => {
    onSelectNoteFromSearch?.(id);
    setSearchModalOpen(false);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 pt-1 pl-4 md:pl-6 pr-4 md:pr-6">
      <nav className="flex items-center gap-1" aria-label="메모·노트 탭">
        <Link
          href="/memo"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            isMemo
              ? "bg-neutral-800 text-white"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          메모
        </Link>
        <Link
          href="/memo/note"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            pathname === "/memo/note"
              ? "bg-neutral-800 text-white"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          노트
        </Link>
      </nav>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial sm:flex-none">
        {rightContent}
        <div ref={searchWrapRef} className="relative w-full min-w-0 max-w-[12rem] sm:w-44">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={rawQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openSearchModal();
              }
            }}
            placeholder=""
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-8 pr-7 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
          />
          {rawQ.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQ("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="검색어 지우기"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {searchModalOpen && isNotePage && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[16rem] overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-500">검색 결과 없음</p>
              ) : (
                <ul className="py-0">
                  {searchResults.map(({ note, isTrash }) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectNote(note.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
                      >
                        <span className="min-w-0 flex-1 truncate">{note.title || "제목 없음"}</span>
                        {isTrash && (
                          <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">
                            휴지통
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
