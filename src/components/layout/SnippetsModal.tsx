"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "my-lifestyle-snippets";

export type Snippet = { id: string; label: string; text: string };

const DEFAULT_SNIPPETS: Snippet[] = [
  { id: "1", label: "Git 푸시", text: "git add .\ngit commit -m \"update\"\ngit push" },
  { id: "2", label: "개발 서버", text: "npm run dev" },
];

function loadSnippets(): Snippet[] {
  if (typeof window === "undefined") return DEFAULT_SNIPPETS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SNIPPETS;
    const parsed = JSON.parse(raw) as Snippet[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SNIPPETS;
  } catch {
    return DEFAULT_SNIPPETS;
  }
}

function saveSnippets(items: Snippet[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

interface SnippetsModalProps {
  onClose: () => void;
}

export function SnippetsModal({ onClose }: SnippetsModalProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editText, setEditText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newText, setNewText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setSnippets(loadSnippets());
  }, []);

  useEffect(() => {
    saveSnippets(snippets);
  }, [snippets]);

  const handleCopy = async (item: Snippet) => {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  const startEdit = (item: Snippet) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditText(item.text);
    setIsAdding(false);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const label = editLabel.trim();
    const text = editText.trim();
    if (!text) return;
    setSnippets((prev) =>
      prev.map((s) => (s.id === editingId ? { ...s, label: label || s.label, text } : s))
    );
    setEditingId(null);
    setEditLabel("");
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditText("");
  };

  const handleDelete = (id: string) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) cancelEdit();
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setNewLabel("");
    setNewText("");
    setEditingId(null);
  };

  const saveAdd = () => {
    const label = newLabel.trim();
    const text = newText.trim();
    if (!text) return;
    const id = String(Date.now());
    setSnippets((prev) => [...prev, { id, label: label || "새 스니펫", text }]);
    setIsAdding(false);
    setNewLabel("");
    setNewText("");
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewLabel("");
    setNewText("");
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="빠른 복사"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">빠른 복사</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">클릭하면 클립보드에 복사돼요. 추가·수정·삭제할 수 있어요.</p>

        <ul className="mt-4 space-y-2">
          {snippets.map((item) => (
            <li key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50/80 transition-all duration-200 hover:bg-neutral-200/90 hover:shadow-md hover:border-neutral-300/80">
              {editingId === item.id ? (
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="이름(선택)"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    placeholder="내용"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(item)}
                    className="min-w-0 flex-1 text-left rounded-lg p-2 transition"
                  >
                    <span className="block text-sm font-medium text-neutral-800">
                      {item.label || item.text.split("\n")[0]?.slice(0, 30) || "이름 없음"}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-neutral-500">
                      {item.text.split("\n")[0]}
                      {item.text.includes("\n") ? " …" : ""}
                    </span>
                  </button>
                  {copiedId === item.id ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-600">복사됨</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                    aria-label="수정"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="삭제"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {isAdding ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="이름(선택)"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              placeholder="복사할 텍스트"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveAdd}
                className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
              >
                추가
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 py-3 text-sm font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            스니펫 추가
          </button>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
