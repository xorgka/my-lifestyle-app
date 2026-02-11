"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MemoNoteTabs } from "../MemoNoteTabs";
import { NoteSidebar } from "./NoteSidebar";
import { NoteEditor } from "./NoteEditor";
import {
  type Notebook,
  type Note,
  loadNotebooks,
  loadNotes,
  loadTrashNotes,
  saveNotebooks,
  saveNotesKeepingTrash,
  createNotebook,
  createNote,
  moveNoteToTrash,
  restoreNote,
  permanentDeleteNote,
  resetNoteLocalData,
} from "@/lib/noteDb";

export default function NotePage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [trashNotes, setTrashNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    danger?: boolean;
    confirmLabel?: string;
  } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (typeof window !== "undefined" && !window.localStorage.getItem("my-lifestyle-note-reset-done-v1")) {
      resetNoteLocalData();
      window.localStorage.setItem("my-lifestyle-note-reset-done-v1", "1");
    }
    let nbList = await loadNotebooks();
    let noteList = await loadNotes();
    const trashList = await loadTrashNotes();

    const resetKey = "my-lifestyle-note-one-notebook-reset";
    if (typeof window !== "undefined" && !window.localStorage.getItem(resetKey) && nbList.length > 1) {
      const keep = nbList[0];
      const removeIds = new Set(nbList.slice(1).map((n) => n.id));
      await saveNotebooks([keep]);
      for (const n of noteList) {
        if (n.notebookId && removeIds.has(n.notebookId)) await moveNoteToTrash(n.id);
      }
      window.localStorage.setItem(resetKey, "1");
      nbList = [keep];
      noteList = await loadNotes();
    }

    setNotebooks(nbList);
    setNotes(noteList);
    setTrashNotes(trashList);
    setSelectedNoteId((prev) => {
      if (typeof window !== "undefined" && window.innerWidth < 768) return null;
      if (prev && (noteList.some((n) => n.id === prev) || trashList.some((n) => n.id === prev))) return prev;
      return noteList[0]?.id ?? trashList[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? trashNotes.find((n) => n.id === selectedNoteId) ?? null;
  const isTrashNote = selectedNote != null && !!selectedNote.deletedAt;

  const persistNotebooks = useCallback(async (next: Notebook[]) => {
    setNotebooks(next);
    await saveNotebooks(next);
  }, []);

  const persistNotes = useCallback(async (next: Note[]) => {
    setNotes(next);
    await saveNotesKeepingTrash(next);
  }, []);

  const handleAddNotebook = useCallback(() => {
    const nb = createNotebook();
    setNotebooks((prev) => [...prev, nb]);
    persistNotebooks([...notebooks, nb]).catch(() => {});
  }, [notebooks, persistNotebooks]);

  const handleAddNote = useCallback(
    (notebookId: string | null) => {
      const note = createNote(notebookId);
      const next = [note, ...notes];
      setNotes(next);
      setSelectedNoteId(note.id);
      persistNotes(next).catch(() => {});
    },
    [notes, persistNotes]
  );

  const handleToggleNotebook = useCallback(
    async (id: string) => {
      const next = notebooks.map((nb) =>
        nb.id === id ? { ...nb, collapsed: !nb.collapsed } : nb
      );
      await persistNotebooks(next);
    },
    [notebooks, persistNotebooks]
  );

  const handleNotebookTitleChange = useCallback(
    async (id: string, title: string) => {
      const next = notebooks.map((nb) => (nb.id === id ? { ...nb, title } : nb));
      await persistNotebooks(next);
    },
    [notebooks, persistNotebooks]
  );

  const handleNoteTitleChange = useCallback(
    (title: string) => {
      if (!selectedNote) return;
      const next = notes.map((n) =>
        n.id === selectedNote.id ? { ...n, title, updatedAt: new Date().toISOString() } : n
      );
      setNotes(next);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveNotesKeepingTrash(next), 400);
    },
    [selectedNote, notes]
  );

  const handleNoteContentChange = useCallback(
    (content: string) => {
      if (!selectedNote) return;
      const next = notes.map((n) =>
        n.id === selectedNote.id ? { ...n, content, updatedAt: new Date().toISOString() } : n
      );
      setNotes(next);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveNotesKeepingTrash(next), 500);
    },
    [selectedNote, notes]
  );

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNote) return;
    await moveNoteToTrash(selectedNote.id);
    setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
    setSelectedNoteId((prev) => (prev === selectedNote.id ? null : prev));
    setTrashNotes(await loadTrashNotes());
  }, [selectedNote]);

  const handleRestore = useCallback(async (id: string) => {
    await restoreNote(id);
    await load();
  }, [load]);

  const doDeleteNotebook = useCallback(
    async (id: string) => {
      const notesInNb = notes.filter((n) => n.notebookId === id);
      for (const n of notesInNb) await moveNoteToTrash(n.id);
      const nextNotebooks = notebooks.filter((nb) => nb.id !== id);
      await saveNotebooks(nextNotebooks);
      setNotebooks(nextNotebooks);
      const nextNotes = notes.filter((n) => n.notebookId !== id);
      setNotes(nextNotes);
      setTrashNotes(await loadTrashNotes());
      if (notesInNb.some((n) => n.id === selectedNoteId)) setSelectedNoteId(nextNotes[0]?.id ?? null);
    },
    [notebooks, notes, selectedNoteId]
  );

  const handleDeleteNotebook = useCallback(
    (id: string) => {
      setConfirmDialog({
        message: "이 노트북을 삭제할까요? 안의 노트는 휴지통으로 이동해요.",
        onConfirm: () => {
          setConfirmDialog(null);
          doDeleteNotebook(id);
        },
      });
    },
    [doDeleteNotebook]
  );

  const handlePermanentDelete = useCallback((id: string) => {
    setConfirmDialog({
      message: "완전히 삭제할까요? 복원할 수 없어요.",
      danger: true,
      confirmLabel: "삭제",
      onConfirm: async () => {
        setConfirmDialog(null);
        await permanentDeleteNote(id);
        setTrashNotes(await loadTrashNotes());
        setSelectedNoteId((prev) => (prev === id ? null : prev));
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <div className="min-w-0 space-y-6">
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
          confirmLabel={confirmDialog.confirmLabel}
        />
      )}
      <SectionTitle
        title="노트"
        subtitle="긴글을 적고, 노트북으로 묶어서 볼 수 있어요."
      />
      <MemoNoteTabs
        notesForSearch={notes}
        trashNotesForSearch={trashNotes}
        onSelectNoteFromSearch={(id) => setSelectedNoteId(id)}
      />

      <div className="flex h-[calc(100vh-14rem)] min-h-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-white pr-2 pb-2 shadow-sm sm:min-h-[400px] sm:pr-3 sm:pb-3 md:h-[calc(100vh-18rem)] md:min-h-[400px] md:pr-4 md:pb-4">
        {/* 모바일: 선택 전에는 목록만, 선택 시 숨김. 데스크톱: 항상 목록 표시 */}
        <div
          className={
            selectedNoteId
              ? "hidden md:flex w-48 shrink-0 flex-col overflow-hidden rounded-tl-xl rounded-bl-xl md:w-56"
              : "flex w-full shrink-0 flex-col overflow-hidden rounded-tl-xl rounded-bl-xl md:w-56"
          }
        >
          <NoteSidebar
            notebooks={notebooks}
            notes={notes}
            trashNotes={trashNotes}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
            onToggleNotebook={handleToggleNotebook}
            onNotebookTitleChange={handleNotebookTitleChange}
            onAddNotebook={handleAddNotebook}
            onAddNote={handleAddNote}
            onDeleteNotebook={handleDeleteNotebook}
            editingNotebookId={editingNotebookId}
            setEditingNotebookId={setEditingNotebookId}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
          />
        </div>
        {/* 모바일: 선택 시에만 에디터 표시 + 목록 버튼. 데스크톱: 항상 에디터 표시 */}
        <div
          className={
            selectedNoteId
              ? "flex min-w-0 flex-1 flex-col pl-0 md:pl-4"
              : "hidden min-w-0 flex-1 flex-col pl-0 md:flex md:pl-4"
          }
        >
          <NoteEditor
            note={selectedNote}
            onTitleChange={handleNoteTitleChange}
            onContentChange={handleNoteContentChange}
            onDelete={handleDeleteNote}
            isTrashNote={isTrashNote}
            onRestore={isTrashNote && selectedNote ? () => handleRestore(selectedNote.id) : undefined}
            onPermanentDelete={isTrashNote && selectedNote ? () => handlePermanentDelete(selectedNote.id) : undefined}
            onBack={selectedNoteId ? () => setSelectedNoteId(null) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
