"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Note } from "@/lib/noteDb";

type NoteEditorProps = {
  note: Note | null;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onDelete: () => void;
  /** 휴지통 노트 보기 모드: 읽기 전용, 복원/완전 삭제만 표시 */
  isTrashNote?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  /** 모바일에서 목록으로 돌아가기. 있으면 헤더 왼쪽에 뒤로가기 버튼 표시 */
  onBack?: () => void;
};

const HIGHLIGHT_COLOR = "#fef08a";

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours();
    const min = d.getMinutes();
    return `${y}. ${m}. ${day}. ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

const COLORS = [
  { label: "검정", value: "#1a1a1a" },
  { label: "빨강", value: "#dc2626" },
  { label: "파랑", value: "#2563eb" },
  { label: "초록", value: "#16a34a" },
  { label: "보라", value: "#9333ea" },
];

export function NoteEditor({ note, onTitleChange, onContentChange, onDelete, isTrashNote, onRestore, onPermanentDelete, onBack }: NoteEditorProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightOn, setHighlightOn] = useState(false);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const close = (e: MouseEvent) => {
      if (colorPickerRef.current?.contains(e.target as Node)) return;
      setColorPickerOpen(false);
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [colorPickerOpen]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !note) return;
    if (el.innerHTML !== note.content) {
      isInternalUpdate.current = true;
      el.innerHTML = note.content;
    }
  }, [note?.id]);

  const emitContent = useCallback(() => {
    const html = contentRef.current?.innerHTML ?? "";
    if (!isInternalUpdate.current) onContentChange(html);
    isInternalUpdate.current = false;
  }, [onContentChange]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.addEventListener("input", emitContent);
    return () => el.removeEventListener("input", emitContent);
  }, [emitContent]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    contentRef.current?.focus();
    emitContent();
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emitContent();
    },
    [emitContent]
  );

  const toggleHighlight = useCallback(() => {
    if (highlightOn) {
      exec("removeFormat");
      setHighlightOn(false);
    } else {
      exec("backColor", HIGHLIGHT_COLOR);
      setHighlightOn(true);
    }
  }, [highlightOn]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTrashNote) return;
      if (e.ctrlKey && e.shiftKey) {
        if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          exec("bold");
        } else if (e.key.toLowerCase() === "h") {
          e.preventDefault();
          toggleHighlight();
        }
      }
    },
    [isTrashNote, toggleHighlight]
  );

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-8 text-neutral-400">
        <p className="text-sm">노트를 선택하거나 새 노트를 만드세요.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 md:px-5 md:py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex md:hidden min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            aria-label="목록"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {isTrashNote ? (
          <>
            <span className="min-w-0 flex-1 truncate text-lg font-semibold text-neutral-500">{note.title || "제목 없음"}</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onRestore}
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100"
              >
                복원
              </button>
              <button
                type="button"
                onClick={onPermanentDelete}
                className="rounded-lg px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
              >
                완전 삭제
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              value={note.title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="제목"
              className="min-w-0 flex-1 rounded border-0 bg-transparent text-lg font-semibold text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0"
            />
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-500"
              title="휴지통으로"
              aria-label="휴지통으로"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>

      {!isTrashNote && (
      <div className="relative hidden shrink-0 flex-wrap items-center gap-1 border-b border-neutral-200 px-4 py-2 md:flex">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="굵게"
        >
          <span className="text-sm font-bold">B</span>
        </button>
        <span className="text-neutral-300">|</span>
        <div className="relative" ref={colorPickerRef}>
          <button
            type="button"
            onClick={() => setColorPickerOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100"
            title="글자색"
          >
            <span className="h-4 w-4 rounded-full border border-neutral-300" style={{ backgroundColor: "#1a1a1a" }} />
          </button>
          {colorPickerOpen && (
            <>
              <div className="absolute left-0 top-full z-20 mt-1 flex gap-0.5 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      exec("foreColor", c.value);
                      setColorPickerOpen(false);
                    }}
                    className="h-6 w-6 rounded border border-neutral-200"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-neutral-300">|</span>
        <button
          type="button"
          onClick={toggleHighlight}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="형광펜"
        >
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded text-xs font-medium"
            style={{ backgroundColor: HIGHLIGHT_COLOR, color: "#854d0e" }}
          >
            A
          </span>
        </button>
        <span className="text-neutral-300">|</span>
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="글머리 기호"
        >
          <svg className="h-4 w-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-neutral-300">|</span>
        <button
          type="button"
          onClick={() => exec("formatBlock", "h2")}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="제목 (글자 크고 두껍게)"
        >
          <span className="text-base font-bold text-neutral-700">H</span>
        </button>
        <span className="text-neutral-300">|</span>
        <button
          type="button"
          onClick={() => {
            exec("insertHorizontalRule");
          }}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="구분선"
        >
          <svg className="h-4 w-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
          </svg>
        </button>
        {note.createdAt && (
          <span className="ml-auto text-xs text-neutral-300" title="최초 작성">
            {formatCreatedAt(note.createdAt)}
          </span>
        )}
      </div>
      )}

      <div
        ref={contentRef}
        contentEditable={!isTrashNote}
        suppressContentEditableWarning
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[19px] text-neutral-800 outline-none [&_ul]:list-disc [&_li]:ml-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-neutral-900 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-neutral-200 [&_hr]:my-5 md:text-[20px] md:[&_h2]:text-3xl"
        style={{ minHeight: 200 }}
        onInput={emitContent}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
