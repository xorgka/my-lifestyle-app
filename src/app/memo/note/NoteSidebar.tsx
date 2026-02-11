"use client";

import { useState } from "react";
import type { Notebook, Note } from "@/lib/noteDb";

type NoteSidebarProps = {
  notebooks: Notebook[];
  notes: Note[];
  trashNotes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onToggleNotebook: (id: string) => void;
  onNotebookTitleChange: (id: string, title: string) => void;
  onAddNotebook: () => void;
  onAddNote: (notebookId: string | null) => void;
  onDeleteNotebook: (id: string) => void;
  editingNotebookId: string | null;
  setEditingNotebookId: (id: string | null) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
};

function NotebookSection({
  nb,
  nbNotes,
  isOpen,
  isEditing,
  selectedNoteId,
  onSelectNote,
  onToggleNotebook,
  onNotebookTitleChange,
  onAddNote,
  onDeleteNotebook,
  setEditingNotebookId,
}: {
  nb: Notebook;
  nbNotes: Note[];
  isOpen: boolean;
  isEditing: boolean;
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onToggleNotebook: (id: string) => void;
  onNotebookTitleChange: (id: string, title: string) => void;
  onAddNote: (notebookId: string) => void;
  onDeleteNotebook: (id: string) => void;
  setEditingNotebookId: (id: string | null) => void;
}) {
  const title = nb.title && nb.title !== "새 노트북" ? nb.title : "제목 없음";
  return (
    <div className="shrink-0 border-b border-neutral-200">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onToggleNotebook(nb.id)}
          className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
          aria-label={isOpen ? "접기" : "펼치기"}
        >
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {isEditing ? (
          <input
            type="text"
            value={nb.title}
            onChange={(e) => onNotebookTitleChange(nb.id, e.target.value)}
            onBlur={() => setEditingNotebookId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setEditingNotebookId(null);
              }
            }}
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-neutral-400"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditingNotebookId(nb.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onDeleteNotebook(nb.id);
            }}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-neutral-600"
          >
            {title}
          </button>
        )}
        <button
          type="button"
          onClick={() => onAddNote(nb.id)}
          className="shrink-0 rounded p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
          title="노트 추가"
        >
          +
        </button>
      </div>
      {isOpen && (
        <ul className="ml-4 max-h-48 overflow-y-auto border-l border-neutral-200 pl-2 pb-2 pt-0">
          {nbNotes.length === 0 ? (
            <li className="px-1 py-1 text-xs text-neutral-400">노트 없음</li>
          ) : (
            nbNotes.map((note) => (
              <li key={note.id} className="py-0.5 first:pt-0.5">
                <button
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  className={`block w-full truncate rounded px-1.5 py-1 text-left text-sm ${
                    selectedNoteId === note.id
                      ? "bg-neutral-200 font-medium text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-200/70"
                  }`}
                >
                  {note.title || "제목 없음"}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function NoteSidebar({
  notebooks,
  notes,
  trashNotes,
  selectedNoteId,
  onSelectNote,
  onToggleNotebook,
  onNotebookTitleChange,
  onAddNotebook,
  onAddNote,
  onDeleteNotebook,
  editingNotebookId,
  setEditingNotebookId,
  onRestore,
  onPermanentDelete,
}: NoteSidebarProps) {
  const [trashOpen, setTrashOpen] = useState(false);

  const notesByNotebook = new Map<string, Note[]>();
  notes.forEach((n) => {
    if (n.notebookId) {
      const list = notesByNotebook.get(n.notebookId) ?? [];
      list.push(n);
      notesByNotebook.set(n.notebookId, list);
    }
  });
  notesByNotebook.forEach((list) =>
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  );

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-neutral-200 bg-neutral-50/60">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {notebooks.map((nb) => (
          <NotebookSection
            key={nb.id}
            nb={nb}
            nbNotes={notesByNotebook.get(nb.id) ?? []}
            isOpen={!nb.collapsed}
            isEditing={editingNotebookId === nb.id}
            selectedNoteId={selectedNoteId}
            onSelectNote={onSelectNote}
            onToggleNotebook={onToggleNotebook}
            onNotebookTitleChange={onNotebookTitleChange}
            onAddNote={onAddNote}
            onDeleteNotebook={onDeleteNotebook}
            setEditingNotebookId={setEditingNotebookId}
          />
        ))}

        <div className="shrink-0 border-b border-neutral-200 py-2">
          <button
            type="button"
            onClick={onAddNotebook}
            className="flex w-full items-center justify-center py-2 text-neutral-400 opacity-70 transition hover:opacity-100 hover:text-neutral-500"
            title="노트북 추가"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200/60 text-lg font-medium">
              +
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => setTrashOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <svg
              className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${trashOpen ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-neutral-600">휴지통</span>
          </button>
          {trashOpen && (
            <ul className="ml-4 border-l border-neutral-200 pl-2">
              {trashNotes.length === 0 ? (
                <li className="px-1.5 py-0.5 text-xs text-neutral-400">비어 있음</li>
              ) : (
                trashNotes.map((n) => (
                  <li key={n.id} className="group/trash flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectNote(n.id)}
                      className={`min-w-0 flex-1 truncate py-0.5 text-left text-sm ${
                        selectedNoteId === n.id ? "font-medium text-neutral-700" : "text-neutral-500 hover:text-neutral-600"
                      }`}
                    >
                      {n.title || "제목 없음"}
                    </button>
                    <div className="flex shrink-0 gap-0.5 opacity-0 group-hover/trash:opacity-100">
                      <button
                        type="button"
                        onClick={() => onRestore(n.id)}
                        className="rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-200"
                      >
                        복원
                      </button>
                      <button
                        type="button"
                        onClick={() => onPermanentDelete(n.id)}
                        className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
