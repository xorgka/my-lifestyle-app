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

/** 윗줄 형제 없이 Tab 할 때: 중첩 ul을 만들지 않고 같은 li만 옆으로 밀어 점(글머리) 하나 유지 */
const NOTE_LIST_INDENT_ATTR = "data-note-indent";
const NOTE_LIST_INDENT_EM = 1.35;
const NOTE_LIST_INDENT_MAX = 8;

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

function isListElement(el: Element | null): el is HTMLUListElement | HTMLOListElement {
  return !!el && (el.tagName === "UL" || el.tagName === "OL");
}

function nestLiUnderParentLi(
  li: HTMLLIElement,
  parentLi: HTMLLIElement,
  listTag: "UL" | "OL"
): void {
  let sub = parentLi.querySelector(":scope > ul, :scope > ol") as HTMLUListElement | HTMLOListElement | null;
  if (!sub) {
    sub = document.createElement(listTag === "OL" ? "ol" : "ul");
    parentLi.appendChild(sub);
  }
  const oldList = li.parentElement;
  sub.appendChild(li);
  if (oldList && isListElement(oldList) && oldList.childElementCount === 0) {
    oldList.remove();
  }
}

function indentLiWithoutPriorSibling(li: HTMLLIElement): void {
  const lv = Math.min(
    NOTE_LIST_INDENT_MAX,
    (parseInt(li.getAttribute(NOTE_LIST_INDENT_ATTR) || "0", 10) || 0) + 1
  );
  li.setAttribute(NOTE_LIST_INDENT_ATTR, String(lv));
  li.style.marginLeft = `${lv * NOTE_LIST_INDENT_EM}em`;
}

function outdentMarginIndent(li: HTMLLIElement): boolean {
  const raw = li.getAttribute(NOTE_LIST_INDENT_ATTR);
  const lv = raw != null ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(lv) || lv <= 0) return false;
  const next = lv - 1;
  if (next <= 0) {
    li.removeAttribute(NOTE_LIST_INDENT_ATTR);
    li.style.marginLeft = "";
  } else {
    li.setAttribute(NOTE_LIST_INDENT_ATTR, String(next));
    li.style.marginLeft = `${next * NOTE_LIST_INDENT_EM}em`;
  }
  return true;
}

/**
 * 목록 들여쓰기: 위 형제 li가 있으면 하위 목록으로 넣음.
 * 없으면 같은 li에 margin만 줘서 점은 하나만 유지(중첩 ul/li 안 만듦).
 */
function indentListItem(li: HTMLLIElement, root: HTMLElement): boolean {
  const parentList = li.parentElement;
  if (!parentList || !isListElement(parentList) || !root.contains(parentList)) return false;

  const listTag = parentList.tagName === "OL" ? "OL" : "UL";
  const prev = li.previousElementSibling;
  if (prev && prev.tagName === "LI") {
    nestLiUnderParentLi(li, prev as HTMLLIElement, listTag);
  } else {
    indentLiWithoutPriorSibling(li);
  }
  return true;
}

function outdentListItem(li: HTMLLIElement): boolean {
  if (outdentMarginIndent(li)) return true;
  const innerList = li.parentElement;
  if (!innerList || !isListElement(innerList)) return false;
  const parentLi = innerList.parentElement;
  if (!parentLi || parentLi.tagName !== "LI") return false;
  const outerList = parentLi.parentElement;
  if (!outerList || !isListElement(outerList)) return false;
  outerList.insertBefore(li, parentLi.nextSibling);
  if (innerList.childElementCount === 0) innerList.remove();
  if (parentLi.childElementCount === 0 && !parentLi.textContent?.trim()) {
    parentLi.remove();
  }
  return true;
}

function placeCaretInElement(el: HTMLElement, atEnd: boolean) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(!atEnd);
  sel.removeAllRanges();
  sel.addRange(r);
}

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

  /** capture: 브라우저 Tab 포커스 이동보다 먼저 잡아서 목록 들여쓰기가 항상 적용되게 함 */
  const handleContentKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTrashNote) return;
      const isTab = e.key === "Tab" || e.code === "Tab";
      if (!isTab || e.ctrlKey || e.metaKey || e.altKey) return;
      const root = contentRef.current;
      if (!root) return;
      const sel = document.getSelection();
      const anchor = sel?.anchorNode;
      if (!sel || anchor == null || !root.contains(anchor)) return;
      let node: Node | null = sel.focusNode ?? anchor;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const liEl = (node as Element | null)?.closest?.("li");
      if (!liEl || !root.contains(liEl) || !(liEl instanceof HTMLLIElement)) return;

      const ok = e.shiftKey ? outdentListItem(liEl) : indentListItem(liEl, root);
      if (!ok) return;
      e.preventDefault();
      e.stopPropagation();
      placeCaretInElement(liEl, true);
      emitContent();
    },
    [isTrashNote, emitContent]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTrashNote) return;
      if (e.ctrlKey && e.shiftKey) {
        if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          exec("bold");
        } else if (e.key === ">") {
          e.preventDefault();
          // 파란색 ▶ + 이후 입력도 파란색 유지
          document.execCommand("foreColor", false, "#2563eb");
          document.execCommand("insertText", false, "▶ ");
          contentRef.current?.focus();
          emitContent();
        } else if (e.key.toLowerCase() === "u") {
          e.preventDefault();
          exec("underline");
        } else if (e.key.toLowerCase() === "h") {
          e.preventDefault();
          toggleHighlight();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          document.execCommand("insertHorizontalRule", false);
          emitContent();
        }
        return;
      }
      // "- " + 스페이스 → 글머리 기호(목록)
      if (e.key === " ") {
        const sel = document.getSelection();
        const el = contentRef.current;
        if (!sel || sel.rangeCount === 0 || !el || !el.contains(sel.anchorNode)) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;
        let block: Node | null = range.startContainer;
        if (block.nodeType === Node.TEXT_NODE) block = block.parentNode;
        while (block && block !== el) {
          const tag = (block as Element).tagName;
          if (tag === "P" || tag === "DIV" || tag === "LI" || tag === "H1" || tag === "H2" || tag === "H3") break;
          block = block.parentNode;
        }
        if (!block || block === el) block = el.firstChild || el;
        if (!block) return;
        const tag = (block as Element).tagName;
        if (tag === "LI") return;
        const rangeToStart = document.createRange();
        try {
          rangeToStart.setStart(block, 0);
          rangeToStart.setEnd(range.startContainer, range.startOffset);
        } catch {
          return;
        }
        const textBefore = rangeToStart.toString().replace(/\s/g, " ").trim();
        if (textBefore !== "-") return;
        e.preventDefault();
        rangeToStart.deleteContents();
        document.execCommand("insertUnorderedList", false);
        emitContent();
      }
    },
    [isTrashNote, toggleHighlight, emitContent]
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
          title="굵게 (Ctrl+Shift+B)"
        >
          <span className="text-sm font-bold">B</span>
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="밑줄 (Ctrl+Shift+U)"
        >
          <span className="text-sm underline underline-offset-2">U</span>
        </button>
        <button
          type="button"
          onClick={() => {
            document.execCommand("foreColor", false, "#2563eb");
            document.execCommand("insertText", false, "▶ ");
            contentRef.current?.focus();
            emitContent();
          }}
          className="rounded p-1.5 hover:bg-neutral-100"
          title="▶ (Ctrl+Shift+>)"
        >
          <span className="text-sm font-semibold text-blue-600">▶</span>
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
          title="형광펜 (Ctrl+Shift+H)"
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
          title="글머리 기호 (목록 안 Tab: 한 단계 들여쓰기, Shift+Tab: 한 단계 내어쓰기)"
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
          title="구분선 (Ctrl+Shift+-)"
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
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[17px] text-neutral-800 outline-none [&_ul]:list-disc [&_li]:ml-4 [&_li>ul]:ml-4 [&_li>ul]:mt-1 [&_li>ul]:list-[circle] [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-neutral-900 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-neutral-200 [&_hr]:my-5 md:text-[20px] md:[&_h2]:text-[26px]"
        style={{ minHeight: 200 }}
        onInput={emitContent}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyDownCapture={handleContentKeyDownCapture}
      />
    </div>
  );
}
