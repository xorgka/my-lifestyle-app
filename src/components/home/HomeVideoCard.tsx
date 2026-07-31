"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HOME_VIDEO_CATEGORIES,
  listStorageVideos,
  type HomeVideoCategoryId,
} from "@/lib/homeVideos";

const CATEGORY_STORAGE_KEY = "home-video-category";

/** 이전 버전(한글 라벨 저장) 호환 */
function normalizeStoredCategory(raw: string | null): HomeVideoCategoryId | null {
  if (!raw) return null;
  const def = HOME_VIDEO_CATEGORIES.find((c) => c.id === raw || c.label === raw);
  return def?.id ?? null;
}

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

type VideoItem = { name: string; url: string };
type VideosByCategory = Record<HomeVideoCategoryId, VideoItem[]>;

/** 로컬 폴더(public/videos, 로컬 실행 시) + Supabase Storage 목록을 카테고리별로 합침 */
async function loadAllVideos(): Promise<{ byCategory: VideosByCategory; namesKey: string }> {
  // 1) 로컬 서버의 public/videos 폴더 (배포 환경에서는 빈 목록)
  let localByFolder: Record<string, string[]> = {};
  try {
    const r = await fetch("/api/videos");
    if (r.ok) {
      localByFolder = ((await r.json()) as { categories?: Record<string, string[]> }).categories ?? {};
    }
  } catch {
    // 무시하고 Storage만 사용
  }
  const byCategory = {} as VideosByCategory;
  const names: string[] = [];
  for (const def of HOME_VIDEO_CATEGORIES) {
    const items: VideoItem[] = [];
    for (const url of localByFolder[def.folder] ?? []) {
      const name = decodeURIComponent(url.split("/").pop() ?? url);
      items.push({ name, url });
    }
    for (const s of await listStorageVideos(def.id)) {
      // 같은 파일명이 로컬 폴더에도 있으면 로컬 파일 우선 (전송량 절약)
      if (!items.some((i) => i.name === s.name)) items.push({ name: s.name, url: s.url });
    }
    byCategory[def.id] = items;
    items.forEach((i) => names.push(`${def.id}/${i.name}`));
  }
  return { byCategory, namesKey: names.sort().join("|") };
}

/** 세로(쇼츠) 영상 플레이어 카드. 카테고리 내 랜덤 순서 재생, 끝나면 자동 다음 */
export function HomeVideoCard({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videosByCategory, setVideosByCategory] = useState<VideosByCategory | null>(null);
  const [category, setCategory] = useState<HomeVideoCategoryId>("insight");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const namesKeyRef = useRef<string | null>(null);
  /** 확대/축소 시 <video>가 새 DOM 노드로 다시 마운트되므로, 재생 위치를 저장했다 복원 */
  const resumeStateRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);

  const loadList = useCallback(() => {
    loadAllVideos()
      .then(({ byCategory, namesKey }) => {
        // 파일 구성이 그대로면 갱신 생략 → 재생 중 셔플이 다시 일어나지 않음
        if (namesKey === namesKeyRef.current) return;
        namesKeyRef.current = namesKey;
        setVideosByCategory(byCategory);
      })
      .catch(() => {
        setVideosByCategory((prev) => prev ?? ({ insight: [], workout: [], etc: [] } as VideosByCategory));
      });
  }, []);

  useEffect(() => {
    try {
      const stored = normalizeStoredCategory(window.localStorage.getItem(CATEGORY_STORAGE_KEY));
      if (stored) setCategory(stored);
    } catch {
      // ignore
    }
    loadList();
    // 폴더에 영상을 넣거나 설정에서 업로드하고 돌아오면 자동으로 목록 갱신
    const onFocus = () => loadList();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 목록 로드 or 카테고리 변경 시 랜덤 순서로 재구성
  useEffect(() => {
    if (!videosByCategory) return;
    setQueue(shuffle((videosByCategory[category] ?? []).map((v) => v.url)));
    setIndex(0);
  }, [videosByCategory, category]);

  const src = queue.length > 0 ? queue[index % queue.length] : null;

  // 영상이 바뀔 때 <video> 엘리먼트는 그대로 두고 소스만 다시 불러옴 (리마운트로 인한 박스 크기 깜빡임 방지)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.load();
    if (playing) {
      video.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, []);

  const goTo = useCallback(
    (delta: number) => {
      if (queue.length === 0) return;
      setIndex((i) => (i + delta + queue.length) % queue.length);
    },
    [queue.length]
  );

  const toggleExpanded = useCallback(() => {
    // 확대/축소는 body로 포탈을 옮기며 <video>가 재마운트되므로 재생 위치를 저장해뒀다가 복원
    const video = videoRef.current;
    resumeStateRef.current = video ? { time: video.currentTime, wasPlaying: !video.paused } : null;
    setExpanded((v) => !v);
  }, []);

  // 확대 중 Esc로 닫기
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  /** 전역 단축키: 1 = 재생/정지, 2 = 이전, 3 = 다음, f = 확대/원상복귀. 모바일/데스크톱용 카드가
   * 동시에 마운트되므로 실제로 화면에 보이는(=display:none이 아닌) 인스턴스만 반응. position:fixed
   * (확대 모드)에서는 offsetParent가 신뢰할 수 없어 getClientRects로 판단. 입력 필드에 포커스 있을 때는 무시 */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== "1" && key !== "2" && key !== "3" && key !== "f") return;
      const active = document.activeElement;
      if (
        active &&
        (active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable))
      ) {
        return;
      }
      if (!containerRef.current || containerRef.current.getClientRects().length === 0) return;
      if (key === "1") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (key === "2") {
        e.preventDefault();
        goTo(-1);
        return;
      }
      if (key === "3") {
        e.preventDefault();
        goTo(1);
        return;
      }
      e.preventDefault();
      toggleExpanded();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, goTo, toggleExpanded]);

  const selectCategory = (c: HomeVideoCategoryId) => {
    setCategory(c);
    try {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, c);
    } catch {
      // ignore
    }
  };

  const categoryLabel = HOME_VIDEO_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const controlButton =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30";

  const containerClassName = expanded
    ? "fixed inset-0 z-[10000] flex h-screen w-screen flex-col overflow-hidden border-0 bg-neutral-950"
    : `relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-neutral-200/90 bg-neutral-950 shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] ${className}`;

  const cardBody = (
    <>
      {src ? (
        <video
          ref={videoRef}
          src={src}
          playsInline
          onClick={togglePlay}
          onEnded={() => {
            // pause 이벤트가 ended보다 먼저 발생해 playing이 false로 바뀌므로, 다음 영상 재생 의도를 다시 표시
            setPlaying(true);
            goTo(1);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={() => {
            // 확대/축소로 <video>가 재마운트된 경우, 저장해둔 재생 위치·상태를 복원
            const resume = resumeStateRef.current;
            const video = videoRef.current;
            resumeStateRef.current = null;
            if (!resume || !video) return;
            video.currentTime = resume.time;
            if (resume.wasPlaying) video.play().catch(() => setPlaying(false));
          }}
          className="h-full w-full flex-1 cursor-pointer object-contain"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-3xl" aria-hidden>
            🎬
          </span>
          {videosByCategory === null ? (
            <p className="text-sm text-neutral-400">영상 목록 불러오는 중…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-300">‘{categoryLabel}’에 영상이 없어요</p>
              <p className="text-xs leading-relaxed text-neutral-500">
                설정 → 홈 화면에서 영상을 업로드하면 자동으로 나와요.
                <br />
                (로컬 실행 중이면 public/videos/{categoryLabel} 폴더도 돼요)
              </p>
            </>
          )}
        </div>
      )}

      {/* 카테고리 버튼 */}
      <div className="absolute left-4 top-4 z-10 flex gap-1.5">
        {HOME_VIDEO_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCategory(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition ${
              category === c.id ? "bg-white text-neutral-900" : "bg-white/15 text-white hover:bg-white/30"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 확대(브라우저 화면 꽉 채우기) 토글 */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30"
        aria-label={expanded ? "확대 종료" : "확대"}
      >
        {expanded ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9 3H3v6h2V5h4V3zm6 0v2h4v4h2V3h-6zM5 15H3v6h6v-2H5v-4zm14 4h-4v2h6v-6h-2v4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 4v-4h2v6h-6v-2h4z" />
          </svg>
        )}
      </button>

      {/* 재생 컨트롤 */}
      {src && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-4 pt-12">
          <button type="button" onClick={() => goTo(-1)} className={controlButton} aria-label="이전 영상">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 6h2v12H6zM18 6l-8.5 6L18 18V6z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-neutral-900 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition hover:scale-105"
            aria-label={playing ? "일시정지" : "재생"}
          >
            {playing ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg className="ml-0.5 h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5l11 7-11 7V5z" />
              </svg>
            )}
          </button>
          <button type="button" onClick={() => goTo(1)} className={controlButton} aria-label="다음 영상">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M16 6h2v12h-2zM6 6l8.5 6L6 18V6z" />
            </svg>
          </button>
          <span className="absolute bottom-4 right-4 text-xs font-medium tabular-nums text-white/70">
            {(index % queue.length) + 1} / {queue.length}
          </span>
        </div>
      )}
    </>
  );

  // 확대 모드에서는 body로 포탈해 렌더링 (조상 요소의 backdrop-blur가 fixed 위치 기준을
  // 뷰포트가 아닌 자기 자신으로 바꿔버려, 포탈 없이는 화면 일부만 채워짐)
  if (expanded && typeof document !== "undefined") {
    return createPortal(
      <div ref={containerRef} className={containerClassName}>
        {cardBody}
      </div>,
      document.body
    );
  }

  return (
    <div ref={containerRef} className={containerClassName}>
      {cardBody}
    </div>
  );
}
