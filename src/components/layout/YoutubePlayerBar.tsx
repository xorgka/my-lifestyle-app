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
      const favorites = list.filter((e) => e.favorite);
      if (favorites.length === 0) {
        setCurrentIndex(0);
        return;
      }
      const newIndex = prevId ? favorites.findIndex((e) => e.id === prevId) : -1;
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

  /** 사이드바에서는 즐겨찾기한 항목만 재생·표시 */
  const playlistEntries = entries.filter((e) => e.favorite);
  const current = playlistEntries[currentIndex];
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
    if (playlistEntries.length === 0) return;
    setCurrentIndex((i) => (i - 1 + playlistEntries.length) % playlistEntries.length);
    setIsPlaying(true);
  };

  const goNext = () => {
    if (playlistEntries.length === 0) return;
    setCurrentIndex((i) => (i + 1) % playlistEntries.length);
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

  const isEmpty = playlistEntries.length === 0;

  /** 전역 단축키: 1 = 재생/정지. 입력 필드에 포커스 있을 때는 무시 */
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "1") return;
      const active = document.activeElement;
      if (
        active &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable))
      ) {
        return;
      }
      if (isEmpty || !current) return;
      e.preventDefault();
      if (isMobile) {
        const { videoId: v, startSeconds: s } = parseYoutubeUrl(current.url);
        window.open(youtubeWatchUrl(v!, s), "_blank", "noopener");
        return;
      }
      const p = playerRef.current;
      if (!p || typeof p.playVideo !== "function") return;
      if (isPlayingRef.current) {
        p.pauseVideo();
        setIsPlaying(false);
      } else {
        p.playVideo();
        setIsPlaying(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEmpty, current, isMobile]);

  return (
    <>
      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-neutral-200 border-b-0 bg-gradient-to-br from-white to-neutral-200 px-3 py-1 shadow-sm">
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
              <p className="text-sm text-neutral-600">즐겨찾기한 항목이 없어요.</p>
              <Link
                href="/youtube/playlist"
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                재생목록 관리에서 즐겨찾기 추가
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
              <div className="flex shrink-0 border-b border-neutral-100 bg-neutral-50/80 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Playist (즐겨찾기)</span>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto py-1.5">
                {playlistEntries.length === 0 ? (
                  <li className="py-6 text-center text-sm text-neutral-500">즐겨찾기한 항목이 없어요.</li>
                ) : (
                  playlistEntries.map((entry, index) => (
                    <li key={entry.id} className="px-2">
                      <button
                        type="button"
                        onClick={() => selectTrack(index)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          index === currentIndex
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums ${
                            index === currentIndex ? "bg-white/20 text-white" : "bg-neutral-200/80 text-neutral-600"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{entry.title || "—"}</span>
                        {index === currentIndex && (
                          <span className="shrink-0 text-white/80" aria-hidden>
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
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
