"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadPlaylistEntries,
  savePlaylistEntry,
  savePlaylistEntries,
  deletePlaylistEntry,
  reorderPlaylistEntries,
  parseYoutubeUrl,
  type PlaylistEntry,
  type PlaylistTags,
} from "@/lib/youtubePlaylistDb";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";

const TAG_KEYS: (keyof PlaylistTags)[] = ["가수", "노래분위기"];
const TAG_LABEL: Record<keyof PlaylistTags, string> = { 가수: "가수", 노래분위기: "분위기", 장르: "장르" };

function getUniqueTagValues(entries: PlaylistEntry[], key: keyof PlaylistTags): string[] {
  const set = new Set<string>();
  entries.forEach((e) => {
    const v = e.tags?.[key]?.trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort();
}

export default function YoutubePlaylistPage() {
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [filterTags, setFilterTags] = useState<PlaylistTags>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PlaylistEntry>>({
    url: "",
    title: "",
    sortOrder: 0,
    startSeconds: undefined,
    tags: {},
  });

  const load = useCallback(() => {
    setLoading(true);
    setDbError(null);
    loadPlaylistEntries()
      .then(setEntries)
      .catch((e) => {
        console.error(e);
        setDbError(e instanceof Error ? e.message : "불러오기 실패");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Supabase 연동 가능 여부 확인 (다른 브라우저에서 DB 오류 원인 파악용) */
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("youtube_playlist")
      .select("id")
      .limit(1)
      .then(({ error }) => {
        if (error) setDbError((prev) => prev || `DB: ${error.message}`);
      });
  }, []);

  const filtered = entries.filter((e) => {
    for (const k of TAG_KEYS) {
      const fv = filterTags[k]?.trim();
      if (!fv) continue;
      if ((e.tags?.[k] ?? "").trim() !== fv) return false;
    }
    return true;
  });

  /** 태그 필터 + 즐겨찾기만 보기 적용한 목록 */
  const displayed = showFavoritesOnly ? filtered.filter((e) => e.favorite) : filtered;

  const openAdd = () => {
    setForm({
      url: "",
      title: "",
      sortOrder: entries.length,
      startSeconds: undefined,
      tags: {},
    });
    setEditingId(null);
    setModal("add");
  };

  const openEdit = (entry: PlaylistEntry) => {
    setForm({ ...entry });
    setEditingId(entry.id);
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
  };

  const toggleFavorite = async (entry: PlaylistEntry) => {
    const next = { ...entry, favorite: !entry.favorite };
    await savePlaylistEntry(next);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? next : e)));
  };

  /** 지금 보이는 목록을 Supabase에 올려서 다른 브라우저/기기에서도 보이게 함 */
  const syncToCloud = async () => {
    if (entries.length === 0) return;
    setSyncing(true);
    try {
      await savePlaylistEntries(entries);
      await load();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("youtube-playlist-changed"));
      if (typeof window !== "undefined") window.alert("클라우드에 저장했습니다. 다른 브라우저에서 새로고침(F5) 해 보세요.");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      if (typeof window !== "undefined") window.alert("클라우드 저장 실패: " + msg + "\n\nSupabase 대시보드에서 youtube_playlist 테이블과 favorite 컬럼, RLS 정책을 확인해 주세요.");
    } finally {
      setSyncing(false);
    }
  };

  const saveEntry = () => {
    const url = form.url?.trim();
    const title = form.title?.trim();
    if (!url) return;
    const { videoId, startSeconds } = parseYoutubeUrl(url);
    if (!videoId) {
      alert("유효한 YouTube 링크를 입력해 주세요.");
      return;
    }
    const id = editingId ?? `pl-${Date.now()}`;
    const sortOrder = form.sortOrder ?? (modal === "add" ? entries.length : 0);
    const entry: PlaylistEntry = {
      id,
      url: url,
      title: title || "제목 없음",
      sortOrder,
      startSeconds,
      tags: form.tags ?? {},
      favorite: form.favorite === true,
    };
    savePlaylistEntry(entry).then(() => {
      load();
      closeModal();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("youtube-playlist-changed"));
    });
  };

  const remove = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("이 항목을 삭제할까요?")) return;
    deletePlaylistEntry(id).then(() => {
      load();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("youtube-playlist-changed"));
    });
  };

  const reorderFiltered = (fromIndex: number, toIndex: number) => {
    const sorted = [...entries].sort((a, b) => a.sortOrder - b.sortOrder);
    const filteredIds = filtered.map((e) => e.id);
    const aId = filteredIds[fromIndex];
    const bId = filteredIds[toIndex];
    const i = sorted.findIndex((e) => e.id === aId);
    const j = sorted.findIndex((e) => e.id === bId);
    if (i < 0 || j < 0) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const next = sorted.map((e, idx) => ({ ...e, sortOrder: idx }));
    savePlaylistEntries(next).then(() => {
      load();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("youtube-playlist-changed"));
    });
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    reorderFiltered(index, index - 1);
  };

  const moveDown = (index: number) => {
    if (index >= filtered.length - 1) return;
    reorderFiltered(index, index + 1);
  };

  /** displayed 목록에서의 index → filtered 목록에서의 index */
  const displayedIndexToFiltered = (entry: PlaylistEntry) => filtered.findIndex((e) => e.id === entry.id);

  return (
    <div className="min-w-0 space-y-4">
      <SectionTitle
        title="재생목록 관리"
        subtitle="유튜브 플레이리스트를 관리할 수 있어요."
      />

      {!isSupabaseConfigured && (
        <Card className="border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
          <strong>다른 브라우저·기기와 연동</strong>하려면 Supabase를 설정하세요. 지금은 이 브라우저에만 저장됩니다.
          <br />
          <span className="text-amber-700">.env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 넣고 서버를 다시 실행하세요.</span>
        </Card>
      )}

      {dbError && (
        <Card className="border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          <strong>DB 연동 실패</strong> — 이 브라우저는 로컬만 사용 중이에요. 다른 기기와 목록이 맞지 않을 수 있어요.
          <br />
          <span className="font-mono text-xs text-red-700">{dbError}</span>
        </Card>
      )}

      {isSupabaseConfigured && entries.length > 0 && !dbError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-800">
          <span>다른 브라우저에서 목록이 안 보이면, 지금 목록을 클라우드에 저장해 보세요.</span>
          <button
            type="button"
            onClick={syncToCloud}
            disabled={syncing}
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {syncing ? "저장 중…" : "클라우드에 저장"}
          </button>
        </Card>
      )}

      {/* 태그로 보기: 한 줄에 가수·분위기 오른쪽 정렬 */}
      <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:py-3">
        <h3 className="text-xs font-semibold text-neutral-700 md:text-sm">태그로 보기</h3>
        <div className="flex flex-wrap items-center gap-3">
          {TAG_KEYS.map((key) => {
            const values = getUniqueTagValues(entries, key);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 md:text-sm">{TAG_LABEL[key]}:</span>
                <select
                  value={filterTags[key] ?? ""}
                  onChange={(e) =>
                    setFilterTags((f) => ({ ...f, [key]: e.target.value || undefined }))
                  }
                  className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-800 md:py-1 md:text-sm"
                >
                  <option value="">전체</option>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
          <h3 className="text-lg font-semibold text-neutral-800">목록</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFavoritesOnly((v) => !v)}
              className={`rounded-lg p-2 transition-colors ${showFavoritesOnly ? "text-red-500" : "text-neutral-400 hover:text-neutral-600"}`}
              title={showFavoritesOnly ? "전체 보기" : "즐겨찾기만 보기"}
              aria-label={showFavoritesOnly ? "전체 보기" : "즐겨찾기만 보기"}
            >
              {showFavoritesOnly ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <span aria-hidden>+</span>
              추가
            </button>
          </div>
        </div>
        {loading ? (
          <div className="py-12 text-center text-neutral-500">불러오는 중…</div>
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center text-neutral-500">
            {entries.length === 0
              ? "등록된 항목이 없어요. 추가 버튼으로 링크를 등록해 보세요."
              : showFavoritesOnly
                ? "즐겨찾기한 항목이 없어요."
                : "선택한 태그에 맞는 항목이 없어요."}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {displayed.map((entry, index) => {
              const filteredIndex = displayedIndexToFiltered(entry);
              return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-neutral-50/80"
              >
                <span className="w-6 text-sm text-neutral-400">{filteredIndex + 1}</span>
                <div className="min-w-0 flex-1">
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-neutral-900 truncate block hover:underline"
                    >
                      {entry.title || "—"}
                    </a>
                  ) : (
                    <div className="font-medium text-neutral-900 truncate">{entry.title || "—"}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(entry)}
                    className={`rounded-lg p-1.5 transition-colors ${entry.favorite ? "text-red-500" : "text-neutral-400 hover:text-neutral-600"}`}
                    aria-label={entry.favorite ? "즐겨찾기 해제" : "즐겨찾기"}
                  >
                    {entry.favorite ? (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveUp(filteredIndex)}
                    disabled={filteredIndex <= 0}
                    className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40"
                    aria-label="위로"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(filteredIndex)}
                    disabled={filteredIndex >= filtered.length - 1 || filteredIndex < 0}
                    className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40"
                    aria-label="아래로"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    className="rounded-lg px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </Card>

      {/* 추가/수정 모달: body에 포탈로 렌더 → 전체 화면 덮고 가운데 정렬 */}
      {modal &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "add" ? "항목 추가" : "항목 수정"}
          >
            <div
              className="absolute inset-0 bg-black/85"
              onClick={closeModal}
              aria-hidden
            />
            <Card className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl mx-4">
              <h2 className="text-lg font-bold text-neutral-900">
                {modal === "add" ? "항목 추가" : "항목 수정"}
              </h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600">YouTube 링크 *</label>
                  <input
                    type="url"
                    value={form.url ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">제목</label>
                  <input
                    type="text"
                    value={form.title ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="영상 제목 (비우면 자동)"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                {TAG_KEYS.map((key) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-neutral-600">{TAG_LABEL[key]}</label>
                    <input
                      type="text"
                      value={form.tags?.[key] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tags: { ...(f.tags ?? {}), [key]: e.target.value.trim() || undefined },
                        }))
                      }
                      placeholder={`예: ${key === "가수" ? "아티스트명" : key === "노래분위기" ? "잔잔함" : "재즈"}`}
                      className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveEntry}
                    className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {modal === "add" ? "추가" : "저장"}
                  </button>
                </div>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </div>
  );
}
