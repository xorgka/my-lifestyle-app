"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  loadPlaylistEntries,
  parseYoutubeUrl,
  youtubeWatchUrl,
  type PlaylistEntry,
} from "@/lib/youtubePlaylistDb";

const YT_SCRIPT = "https://www.youtube.com/iframe_api";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          width?: number;
          height?: number;
          playerVars?: { start?: number };
          events?: { onReady?: () => void };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
}

/** 768 미만이면 모바일로 간주 (유튜브 외부 열기) */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(typeof window !== "undefined" && window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export function YoutubePlayerBar() {
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFavoritesOnly, setDrawerFavoritesOnly] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const [listPanelPos, setListPanelPos] = useState<{ top: number; left: number } | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const isMobile = useIsMobile();
  /** 목록 갱신 시 같은 항목을 가리키도록 유지 (순서 변경 시 재생 트리거 방지) */
  const currentEntryIdRef = useRef<string | null>(null);

  const load = useCallback(() => {
    loadPlaylistEntries().then((list) => {
      const prevId = currentEntryIdRef.current;
      setEntries(list);
      if (list.length === 0) return;
      const newIndex = prevId ? list.findIndex((e) => e.id === prevId) : -1;
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
    });
  }, []);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener("storage", onUpdate);
    window.addEventListener("youtube-playlist-changed", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("youtube-playlist-changed", onUpdate);
    };
  }, [load]);

  const current = entries[currentIndex];
  currentEntryIdRef.current = current?.id ?? null;
  const { videoId, startSeconds } = current ? parseYoutubeUrl(current.url) : { videoId: null, startSeconds: undefined };

  // YouTube IFrame API (PC only) - onReady 후에만 loadVideoById 호출
  useEffect(() => {
    if (isMobile || !videoId || !iframeContainerRef.current) return;
    const init = () => {
      if (!window.YT || !iframeContainerRef.current) return;
      try {
        if (playerRef.current) {
          const p = playerRef.current;
          if (typeof p.loadVideoById === "function") {
            p.loadVideoById(videoId, startSeconds ?? 0);
            if (isPlaying) p.playVideo();
          }
          return;
        }
        const player = new window.YT!.Player(iframeContainerRef.current, {
          videoId,
          width: 640,
          height: 360,
          playerVars: { start: startSeconds ?? 0 },
          events: {
            onReady: () => setPlayerReady(true),
          },
        });
        playerRef.current = player;
      } catch (e) {
        console.warn("[YoutubePlayerBar] player init", e);
      }
    };
    if (window.YT) {
      init();
      return () => {};
    }
    const script = document.createElement("script");
    script.src = YT_SCRIPT;
    script.async = true;
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = init;
    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, [isMobile, videoId]);

  // 영상이 바뀔 때만 로드 (재생/일시정지는 아래 effect에서만)
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !videoId || !playerReady || typeof p.loadVideoById !== "function") return;
    try {
      p.loadVideoById(videoId, startSeconds ?? 0);
      if (isPlaying) p.playVideo();
    } catch (e) {
      console.warn("[YoutubePlayerBar] loadVideoById", e);
    }
  }, [videoId, startSeconds, playerReady]);

  // 재생/일시정지만 토글 (loadVideoById 호출 안 함 → 처음부터 재생 안 함)
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !playerReady || typeof p.playVideo !== "function") return;
    try {
      if (isPlaying) p.playVideo();
      else p.pauseVideo();
    } catch (e) {
      console.warn("[YoutubePlayerBar] play/pause", e);
    }
  }, [isPlaying, playerReady]);

  const goPrev = () => {
    if (entries.length === 0) return;
    setCurrentIndex((i) => (i - 1 + entries.length) % entries.length);
    setIsPlaying(true);
  };

  const goNext = () => {
    if (entries.length === 0) return;
    setCurrentIndex((i) => (i + 1) % entries.length);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (isMobile && current) {
      const url = youtubeWatchUrl(videoId!, startSeconds);
      window.open(url, "_blank", "noopener");
      return;
    }
    if (playerRef.current) {
      if (isPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
      setIsPlaying(!isPlaying);
    }
  };

  const selectTrack = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (!drawerOpen || !listButtonRef.current) return;
    const rect = listButtonRef.current.getBoundingClientRect();
    setListPanelPos({
      top: isMobile ? rect.top : Math.max(16, rect.top - 80),
      left: rect.right + 8,
    });
    return () => setListPanelPos(null);
  }, [drawerOpen, isMobile]);

  const isEmpty = entries.length === 0;

  return (
    <>
      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-200 px-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <svg className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span>Playist</span>
            </div>
            <Link
              href="/youtube/playlist"
              className="-mr-1 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
              aria-label="Playlist 관리"
              title="Playlist 관리"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </Link>
          </div>
          {isEmpty ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-neutral-600">Playist가 비어 있어요.</p>
              <Link
                href="/youtube/playlist"
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                링크 추가하러 가기
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <>
              {/* 제목: 짧으면 왼쪽 정렬, 길면 마퀴 */}
              <TitleDisplay title={current?.title ?? "—"} />
              {/* 컨트롤: 이전 | 재생/정지 | 다음 | 목록 | 설정 */}
              <div className="mt-2 flex items-center justify-between gap-0.5">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="이전"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="rounded-xl p-2 text-neutral-700 hover:bg-neutral-100"
                  aria-label={isPlaying ? "일시정지" : "재생"}
                >
                  {isPlaying ? (
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="다음"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  ref={listButtonRef}
                  type="button"
                  onClick={() => setDrawerOpen((v) => !v)}
                  className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="Playlist"
                  title="Playlist"
                  aria-expanded={drawerOpen}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              {/* PC: 작은 임베드 (모바일에서는 숨김) */}
              {!isMobile && videoId && (
                <div className="mt-2 mb-1 hidden md:block">
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                    <div
                      ref={iframeContainerRef}
                      className="h-full w-full origin-center scale-[1.15] overflow-hidden"
                    />
                    {!isPlaying && (
                      <div
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-black/75 to-black/55"
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Playlist 모달: 삼선 버튼 옆에 표시 */}
      {drawerOpen &&
        typeof document !== "undefined" &&
        document.body &&
        listPanelPos != null &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-[9998] ${isMobile ? "bg-black/50" : ""}`}
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div
              className="fixed z-[9999] flex w-72 max-h-[min(85vh,420px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
              style={
                isMobile
                  ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                  : { top: listPanelPos.top, left: listPanelPos.left }
              }
              role="dialog"
              aria-label="Playlist"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 bg-neutral-50/80 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Playist</span>
                <button
                  type="button"
                  onClick={() => setDrawerFavoritesOnly((v) => !v)}
                  className={`rounded-lg p-1.5 transition-colors ${drawerFavoritesOnly ? "text-red-500" : "text-neutral-400 hover:text-neutral-600"}`}
                  title={drawerFavoritesOnly ? "전체 보기" : "즐겨찾기만 보기"}
                  aria-label={drawerFavoritesOnly ? "전체 보기" : "즐겨찾기만 보기"}
                >
                  {drawerFavoritesOnly ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto py-1.5">
                {(drawerFavoritesOnly ? entries.filter((e) => e.favorite) : entries).map((entry) => {
                  const i = entries.findIndex((e) => e.id === entry.id);
                  return (
                    <li key={entry.id} className="px-2">
                      <button
                        type="button"
                        onClick={() => selectTrack(i)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          i === currentIndex
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums ${
                            i === currentIndex ? "bg-white/20 text-white" : "bg-neutral-200/80 text-neutral-600"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{entry.title || "—"}</span>
                        {i === currentIndex && (
                          <span className="shrink-0 text-white/80" aria-hidden>
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {(drawerFavoritesOnly && entries.filter((e) => e.favorite).length === 0) && (
                <div className="py-6 text-center text-sm text-neutral-500">즐겨찾기한 항목이 없어요.</div>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

/** 제목 무조건 한 줄. 짧으면 왼쪽 정렬, 길면 마퀴로 흐름 */
function TitleDisplay({ title }: { title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [needsMarquee, setNeedsMarquee] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const span = spanRef.current;
    if (!wrap || !span) return;
    const check = () => setNeedsMarquee(span.scrollWidth > wrap.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [title]);

  return (
    <div ref={wrapRef} className="mt-2 min-h-[2rem] overflow-hidden rounded-full bg-white/80 px-3 py-1.5 text-left shadow-md">
      <div className={`text-sm font-medium text-neutral-500 whitespace-nowrap ${needsMarquee ? "youtube-title-marquee" : ""}`}>
        <span ref={spanRef} className="inline-block whitespace-nowrap">{title}</span>
      </div>
    </div>
  );
}
