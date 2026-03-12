"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { localDateStr } from "@/lib/dateUtil";
import {
  type JournalEntry,
  loadJournalEntries,
  saveJournalEntries,
  deleteJournalEntry,
  loadJournalDraftsFromSupabase,
  saveJournalDraftToSupabase,
} from "@/lib/journal";
import { addInsightEntry } from "@/lib/insightDb";

const DRAFT_KEY = "my-lifestyle-journal-drafts";
/** 복사 후 이동 버튼에서 새 창으로 열 링크 (PC에서만 노출) */
const COPY_AND_GO_LINK = "https://www.saramin.co.kr/zf_user/tools/character-counter";

const JOURNAL_SECRET_PIN_HASH = "my-lifestyle-journal-secret-pin-hash";
const JOURNAL_SECRET_UNLOCKED = "my-lifestyle-journal-secret-unlocked";

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getStoredPinHash(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(JOURNAL_SECRET_PIN_HASH);
}

function setStoredPinHash(hash: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOURNAL_SECRET_PIN_HASH, hash);
}

function isSecretUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(JOURNAL_SECRET_UNLOCKED) === "1";
}

function setSecretUnlockedSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(JOURNAL_SECRET_UNLOCKED, "1");
}

function clearSecretUnlockedSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(JOURNAL_SECRET_UNLOCKED);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DraftSnapshot = { content: string; important: boolean; secret?: boolean };
function loadDrafts(): Record<string, DraftSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DraftSnapshot>;
  } catch {
    return {};
  }
}
function saveDraft(date: string, snapshot: DraftSnapshot | null): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadDrafts();
    if (snapshot) all[date] = snapshot;
    else delete all[date];
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {}
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${week})`;
}

/** 첫 문장 또는 첫 줄 (툴팁/미리보기용, 최대 50자) */
function firstLinePreview(content: string, maxLen = 50): string {
  const line = content.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return line.length > maxLen ? line.slice(0, maxLen) + "…" : line;
}

/** 마크다운 볼드·글자색 등 간단 렌더 (미리보기·저장본 표시용) */
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[pink\]([\s\S]+?)\[\/pink\]/g, '<span style="color:#f87171">$1</span>')
    .replace(/\[blue\]([\s\S]+?)\[\/blue\]/g, '<span style="color:#3b82f6">$1</span>')
    .replace(/\[red\]([\s\S]+?)\[\/red\]/g, '<span style="color:#dc2626">$1</span>')
    .replace(/\[gray\]([\s\S]+?)\[\/gray\]/g, '<span style="color:#6b7280">$1</span>')
    .replace(/\[wave\]([\s\S]+?)\[\/wave\]/g, '<span style="text-decoration:underline wavy; text-decoration-color:#a3a3a3">$1</span>')
    .replace(/\n/g, "<br />");
}

/** 날짜 문자열(YYYY-MM-DD) 하루 전 */
function prevDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 해당 날짜 직전까지의 연속 기록 일수 (그날 포함하지 않음) */
function getJournalStreakAsOf(entries: { date: string }[], beforeDateStr: string): number {
  const dateSet = new Set(entries.map((e) => e.date));
  let d = new Date(prevDateStr(beforeDateStr) + "T12:00:00");
  let count = 0;
  for (;;) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    if (!dateSet.has(key)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** 빈 공간에 매일 번갈아 보여줄 문장 (null = 스트릭 메시지로 대체) */
const JOURNAL_EMPTY_PROMPTS: (string | null)[] = [
  "우리는 삶을 두 번 맛보기 위해 글을 쓴다.",
  "점 하나라도 찍어볼까요?\n오늘의 기록을 시작해 보세요.",
  null, // 스트릭 메시지
  "오늘 가장 많이 웃었던 순간은 언제였나요?",
  "오늘 나를 가장 힘들게 했던 일은 무엇인가요?",
  "오늘의 나에게 고생했다고\n한마디 남겨주는 건 어때요?",
  "오늘 하루, 마음속에만 담아두기엔\n아까운 순간이 있었나요?",
  "오늘의 조각들을 이곳에 모아보세요.\n나중에 작은 선물이 될 거예요.",
  "기억은 흐려지고 기록은 남는다.",
  "글쓰기는 자기 자신을 만나는\n가장 정직한 방법이다.",
  "글을 쓴다는 것은\n내 마음속의 소음을\n악보로 옮기는 일이다.",
  "첫 문장을 써라.\n나머지는 그 문장이 알아서 할 것이다.",
  "여러분이 느끼고 고민했던 것을 있는 그대로 표현하도록 노력하세요.\n언젠가 여러분도 자기만의 삶을 긍정하고,\n그것을 표현할 수 있는 시인이나 철학자가 되어 있을 테니까 말입니다.",
  "우리와 예술가의 차이는요,\n그들은 자신의 감정에 솔직하고\n그것을 표현하는데 성공했고,\n우리는 남루하게 그것을 부인하는거죠.",
  "언젠가 회상해 보면,\n당신이 겪은 가장 힘들었던 시절이\n가장 아름다웠던 시기로 기억될 것이다.",
  "나는 영감이 올 때만 글을 쓴다.\n다행히 영감은 매일 아침 9시 정각에 찾아온다.",
  "작가가 되고 싶다면 두 가지만 하면 된다.\n많이 읽고, 많이 쓰는 것이다.",
  "나에게 글쓰기는 연애라기보다 세탁에 가깝다.\n- 무라카미 하루키",
  "문장을 하나 써라.\n당신이 알고 있는 가장 진실한 문장을.",
  "글쓰기는 다른 사람의 삶에 개입하는 것이 아니라,\n자신의 삶을 견디는 방법이다.",
  "영감은 아마추어나 기다리는 것이다.\n우리 프로들은 그냥 아침에 일어나서 일을 하러 간다.",
];

function getEmptyStatePrompt(selectedDate: string, entries: { date: string }[]): string {
  const num = parseInt(selectedDate.replace(/-/g, ""), 10);
  const index = Math.abs(num) % JOURNAL_EMPTY_PROMPTS.length;
  const slot = JOURNAL_EMPTY_PROMPTS[index];
  if (slot === null) {
    const streak = getJournalStreakAsOf(entries, selectedDate);
    if (streak > 0) {
      return `벌써 ${streak}일째 기록 중이시네요!\n오늘도 그 흐름을 이어가 볼까요?`;
    }
    return "오늘도 그 흐름을 이어가 볼까요?";
  }
  return slot;
}

export default function JournalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [draft, setDraft] = useState("");
  const [draftImportant, setDraftImportant] = useState(false);
  const [draftSecret, setDraftSecret] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  /** 초안 자동 저장 상태: idle | pending(2초 대기 중) | saved(방금 저장됨) */
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  /** 저장 버튼 클릭 시 토스트 */
  const [saveToast, setSaveToast] = useState(false);
  const [journalLoading, setJournalLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAllSearchResults, setShowAllSearchResults] = useState(false);
  const [viewMode, setViewMode] = useState<"write" | "preview">("preview");
  /** 달력 셀 호버 시 첫 문장 툴팁 (바로 표시, 크게) */
  const [cellTooltip, setCellTooltip] = useState<{ dateStr: string; text: string; x: number; y: number } | null>(null);
  /** 달력·검색 드로어 열림 */
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** 드로어 슬라이드 인 애니메이션용 */
  const [drawerAnimated, setDrawerAnimated] = useState(false);
  /** 일기장 | 모아보기 탭. URL(?view=collect&year=2024)이 진실 공급원 */
  const [journalViewMode, setJournalViewMode] = useState<"journal" | "collect">("journal");
  const [collectYear, setCollectYear] = useState<number | null>(null);
  const [collectMonth, setCollectMonth] = useState<number | null>(null);
  /** 모아보기 연도 드롭다운 열림 */
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const collectViewRef = useRef<HTMLDivElement>(null);

  /** URL과 모아보기 state 동기화 (연도 선택 시 URL로 이동 → 이 effect에서 화면 전환) */
  const selectYearOpen = searchParams.get("selectYear") === "1";
  useEffect(() => {
    const view = searchParams.get("view");
    const y = searchParams.get("year");
    setYearDropdownOpen(false);
    if (view === "collect" && y) {
      const yearNum = parseInt(y, 10);
      if (!Number.isNaN(yearNum)) {
        setJournalViewMode("collect");
        setCollectYear(yearNum);
        return;
      }
    }
    setJournalViewMode("journal");
    setCollectYear(null);
  }, [searchParams]);
  /** 오늘 마음에 남은 문장 (인사이트) 입력 */
  const [insightInput, setInsightInput] = useState("");
  const [insightAuthorInput, setInsightAuthorInput] = useState("");
  /** 편집 모드: 글자 드래그 후 우클릭 메뉴 (글자색) */
  const [editContextMenu, setEditContextMenu] = useState<{ x: number; y: number; start: number; end: number } | null>(null);
  const editContextMenuRef = useRef<HTMLDivElement>(null);
  /** Supabase에서 초안 동기화 후 true. 새로고침·기기 전환 시 초안 유지 */
  const [draftsSyncedFromSupabase, setDraftsSyncedFromSupabase] = useState(false);
  /** 비밀글 암호 설정: 모달 대신 카드 안 인라인 폼 표시 (보이게) */
  const [showSetPinInline, setShowSetPinInline] = useState(false);
  const [setPinValue, setSetPinValue] = useState("");
  const [setPinConfirm, setSetPinConfirm] = useState("");
  const [setPinError, setSetPinError] = useState("");
  /** 비밀글 보기용 암호 입력 모달 */
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPinValue, setUnlockPinValue] = useState("");
  const [unlockError, setUnlockError] = useState("");
  /** 이 탭에서 비밀글 해제 여부 (sessionStorage와 동기화) */
  const [secretUnlocked, setSecretUnlocked] = useState(false);

  /** 페이지 들어올 때마다 비밀글 해제 상태 리셋 (새로고침·다른 페이지 갔다 오면 무조건 비밀번호 다시 입력) */
  useEffect(() => {
    setSecretUnlocked(false);
  }, []);

  const load = useCallback(async () => {
    setJournalLoading(true);
    try {
      const list = await loadJournalEntries();
      setEntries(list);
      const drafts = await loadJournalDraftsFromSupabase();
      Object.entries(drafts).forEach(([date, snap]) => saveDraft(date, snap));
      setDraftsSyncedFromSupabase(true);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!drawerOpen) {
      setDrawerAnimated(false);
      return;
    }
    const id = requestAnimationFrame(() => setDrawerAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [drawerOpen]);

  useEffect(() => {
    if (!yearDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (yearDropdownRef.current?.contains(e.target as Node)) return;
      setYearDropdownOpen(false);
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [yearDropdownOpen]);

  const entryForDate = entries.find((e) => e.date === selectedDate);
  const currentContent = entryForDate?.content ?? "";
  const isToday = selectedDate === todayStr();

  useEffect(() => {
    const drafts = loadDrafts();
    const savedDraft = drafts[selectedDate];
    if (savedDraft) {
      setDraft(savedDraft.content);
      setDraftImportant(savedDraft.important);
      setDraftSecret(savedDraft.secret ?? false);
    } else {
      setDraft(currentContent);
      setDraftImportant(entryForDate?.important ?? false);
      setDraftSecret(entryForDate?.secret ?? false);
    }
  }, [selectedDate, currentContent, entryForDate?.important, entryForDate?.secret, draftsSyncedFromSupabase]);

  useEffect(() => {
    if (currentContent === draft && (entryForDate?.important ?? false) === draftImportant && (entryForDate?.secret ?? false) === draftSecret) {
      setDraftSaveStatus("idle");
      return;
    }
    setDraftSaveStatus("pending");
    const t = setTimeout(() => {
      if (draft.trim() || draftImportant || draftSecret) {
        const snap = { content: draft, important: draftImportant, secret: draftSecret };
        saveDraft(selectedDate, snap);
        saveJournalDraftToSupabase(selectedDate, snap).catch(() => {});
      } else {
        saveDraft(selectedDate, null);
        saveJournalDraftToSupabase(selectedDate, null).catch(() => {});
      }
      setDraftSaveStatus("saved");
      setTimeout(() => setDraftSaveStatus("idle"), 1500);
    }, 2000);
    return () => clearTimeout(t);
  }, [draft, draftImportant, draftSecret, selectedDate]);

  const save = async () => {
    const next: JournalEntry[] = entries.filter((e) => e.date !== selectedDate);
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      const now = new Date().toISOString();
      next.push({
        date: selectedDate,
        content: trimmed,
        createdAt: entryForDate?.createdAt ?? now,
        updatedAt: now,
        important: draftImportant,
        secret: draftSecret,
      });
      next.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      // 해당 날짜를 비웠을 때 DB/스토리지에서도 삭제 (Supabase는 upsert만 하므로 삭제 호출 필요)
      await deleteJournalEntry(selectedDate).catch(console.error);
    }
    setEntries(next);
    saveDraft(selectedDate, null);
    saveJournalDraftToSupabase(selectedDate, null).catch(() => {});
    await saveJournalEntries(next).catch(console.error);
    setLastSaved(trimmed.length > 0 ? new Date().toISOString() : null);
    setSaveToast(trimmed.length > 0);
    setTimeout(() => setSaveToast(false), 2000);
    setTimeout(() => setLastSaved(null), 2000);
    setViewMode("preview");
  };

  const remove = () => {
    if (!entryForDate) return;
    if (!confirm("이 날짜의 일기를 삭제할까요?")) return;
    const next = entries.filter((e) => e.date !== selectedDate);
    setEntries(next);
    setDraft("");
    setDraftImportant(false);
    setDraftSecret(false);
    deleteJournalEntry(selectedDate).catch(console.error);
  };

  const copyAndGo = async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      window.open(COPY_AND_GO_LINK, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
    }
  };

  /** 편집 모드: 선택 영역에 글자색·물결 밑줄 적용 (우클릭 메뉴용) */
  const applyEditColor = (tag: "blue" | "red" | "gray" | "wave") => {
    if (!editContextMenu) return;
    const { start, end } = editContextMenu;
    const open = tag === "blue" ? "[blue]" : tag === "red" ? "[red]" : tag === "gray" ? "[gray]" : "[wave]";
    const close = tag === "blue" ? "[/blue]" : tag === "red" ? "[/red]" : tag === "gray" ? "[/gray]" : "[/wave]";
    setDraft((prev) => prev.slice(0, start) + open + prev.slice(start, end) + close + prev.slice(end));
    setEditContextMenu(null);
    setTimeout(() => {
      textareaRef.current?.focus();
      const newStart = start + open.length;
      const newEnd = end + open.length;
      textareaRef.current?.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  useEffect(() => {
    if (!editContextMenu) return;
    const close = (e?: MouseEvent) => {
      if (e && editContextMenuRef.current?.contains(e.target as Node)) return;
      setEditContextMenu(null);
    };
    document.addEventListener("mousedown", close, true);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("scroll", close, true);
    };
  }, [editContextMenu]);

  const handleInsightAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = insightInput.trim();
    if (!trimmed) return;
    setInsightInput("");
    setInsightAuthorInput("");
    try {
      await addInsightEntry(trimmed, insightAuthorInput.trim() || undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const [year, month] = selectedDate.split("-").map(Number);
  const entriesByDate = Object.fromEntries(
    entries.map((e) => [e.date, e])
  ) as Record<string, JournalEntry>;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear - 2018 + 1 },
    (_, i) => currentYear - i
  );

  /** 모아보기: 선택 연도에 글 있는 날짜만 (비밀글 포함, 날짜 오름차순. 비밀글은 목록에 포함되고 선택 시 '비밀글' 표시) */
  const entryDatesInYear =
    journalViewMode === "collect" && collectYear != null
      ? entries
          .filter((e) => e.date.startsWith(String(collectYear)))
          .map((e) => e.date)
          .sort()
      : [];
  const collectMonths =
    journalViewMode === "collect" && collectYear != null
      ? Array.from(
          new Set(
            entryDatesInYear.map((d) => {
              const [, m] = d.split("-");
              return Number(m);
            })
          )
        ).sort((a, b) => a - b)
      : [];
  const effectiveCollectMonth =
    collectMonth && collectMonths.includes(collectMonth)
      ? collectMonth
      : (() => {
          const [, m] = selectedDate.split("-");
          const mNum = Number(m);
          return collectMonths.includes(mNum) ? mNum : collectMonths[0] ?? null;
        })();
  const entryDatesInMonth =
    effectiveCollectMonth != null
      ? entryDatesInYear.filter((d) => {
          const [, m] = d.split("-");
          return Number(m) === effectiveCollectMonth;
        })
      : entryDatesInYear;
  const getCollectPreview = (date: string) => {
    const entry = entriesByDate[date];
    if (!entry) return "";
    const raw = entry.content || "";
    const oneLine = raw.replace(/\s+/g, " ").trim();
    if (oneLine.length <= 40) return oneLine;
    return `${oneLine.slice(0, 40)}…`;
  };
  const collectIndex = entryDatesInYear.indexOf(selectedDate);
  const canGoPrevCollect = collectIndex > 0;
  const canGoNextCollect = collectIndex >= 0 && collectIndex < entryDatesInYear.length - 1;
  const goPrevInCollect = () => {
    if (!canGoPrevCollect) return;
    setSelectedDate(entryDatesInYear[collectIndex - 1]);
  };
  const goNextInCollect = () => {
    if (!canGoNextCollect) return;
    setSelectedDate(entryDatesInYear[collectIndex + 1]);
  };

  /** 연도 선택 시 URL 변경 → useEffect에서 모아보기로 전환 (모바일에서 확실히 보이게) */
  const goToCollectYear = (y: number) => {
    setYearDropdownOpen(false);
    const dates = entries.filter((e) => e.date.startsWith(String(y))).map((e) => e.date).sort();
    if (dates.length > 0) setSelectedDate(dates[0]);
    router.replace(`/journal?view=collect&year=${y}`, { scroll: true });
  };

  /** 모아보기 → 일기장으로 돌아가기 (URL 제거하면 effect에서 state 동기화) */
  const goBackToJournal = () => {
    router.replace("/journal", { scroll: true });
  };

  /** 모아보기 화면 진입 시 스크롤해서 보이게 (모바일에서 연도 선택 후 화면이 안 보이는 현상 방지) */
  useEffect(() => {
    if (journalViewMode !== "collect" || collectYear == null || typeof window === "undefined") return;
    const t = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      collectViewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, [journalViewMode, collectYear]);

  /** 모아보기 연도 진입 시 선택 날짜가 해당 연도 목록에 없으면 첫 기록으로 */
  useEffect(() => {
    if (journalViewMode === "collect" && collectYear != null && entryDatesInYear.length > 0 && !entryDatesInYear.includes(selectedDate)) {
      setSelectedDate(entryDatesInYear[0]);
    }
  }, [journalViewMode, collectYear, selectedDate, entryDatesInYear.length, entryDatesInYear[0]]);

  const setCalendarYear = (y: number) => {
    setSelectedDate(`${y}-${String(month).padStart(2, "0")}-01`);
  };

  const setCalendarMonth = (m: number) => {
    setSelectedDate(`${year}-${String(m).padStart(2, "0")}-01`);
  };

  const goPrevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(localDateStr(d));
  };

  const goNextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const next = localDateStr(d);
    if (next > todayStr()) return;
    setSelectedDate(next);
  };

  /** 볼드: 선택 영역을 ** 로 감싸기 (또는 커서 위치에 ** 삽입) */
  const insertBold = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = draft.slice(0, start);
    const selected = draft.slice(start, end);
    const after = draft.slice(end);
    if (selected) {
      setDraft(`${before}**${selected}**${after}`);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 2, end + 2);
      }, 0);
    } else {
      setDraft(`${before}****${after}`);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      const target = document.activeElement?.tagName ?? "";
      const inInput = target === "TEXTAREA" || target === "INPUT";
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevDay();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight") {
        e.preventDefault();
        goNextDay();
        return;
      }
      if (!inInput && (e.key === "a" || e.key === "d")) {
        e.preventDefault();
        if (e.key === "a") goPrevDay();
        else goNextDay();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        insertBold();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDate, draft]);

  const today = todayStr();
  const entryDatesWithContent = new Set(entries.filter((e) => e.content.trim().length > 0).map((e) => e.date));
  const hasTodayContent = entryDatesWithContent.has(today) || (selectedDate === today && draft.trim().length > 0);
  const streak = (() => {
    let count = 0;
    let d = new Date();
    while (true) {
      const key = localDateStr(d);
      if (key > today) break;
      const hasEntry = key === today ? hasTodayContent : entryDatesWithContent.has(key);
      if (hasEntry) count++;
      else if (key !== today) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  const lastRecordLabel = (() => {
    if (entries.length === 0) return null;
    const latest = entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0].date);
    const [y, m, day] = latest.split("-").map(Number);
    const dateLabel = `${m}월 ${day}일`;
    const todayMs = new Date(today + "T12:00:00").getTime();
    const latestMs = new Date(latest + "T12:00:00").getTime();
    const diffDays = Math.floor((todayMs - latestMs) / 86400000);
    const agoLabel = diffDays === 0 ? "오늘" : `${diffDays}일 전`;
    return `${dateLabel} (${agoLabel})`;
  })();

  const [searchQuery, setSearchQuery] = useState("");
  const [showExport, setShowExport] = useState(false);
  const now = new Date();
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportRangeType, setExportRangeType] = useState<"month" | "year" | "range" | "all">("month");
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [exportRangeFrom, setExportRangeFrom] = useState(() => {
    const d = new Date(currentYear - 1, now.getMonth(), now.getDate());
    return localDateStr(d);
  });
  const [exportRangeTo, setExportRangeTo] = useState(todayStr());
  /** 내보내기 형식: MD(마크다운) | TXT(일반 텍스트) */
  const [exportFormat, setExportFormat] = useState<"md" | "txt">("md");
  const searchQueryNorm = searchQuery.trim().toLowerCase();
  const searchResults = searchQueryNorm
    ? entries
        .filter((e) => e.content.toLowerCase().includes(searchQueryNorm))
        .map((e) => e.date)
        .sort()
        .reverse()
    : [];

  const getExportFromTo = (): [string, string] => {
    if (exportRangeType === "month") {
      const y = exportYear;
      const m = String(exportMonth).padStart(2, "0");
      const lastDay = new Date(y, exportMonth, 0).getDate();
      return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, "0")}`];
    }
    if (exportRangeType === "year") {
      return [`${exportYear}-01-01`, `${exportYear}-12-31`];
    }
    if (exportRangeType === "range") {
      return [exportRangeFrom, exportRangeTo];
    }
    return ["2000-01-01", "2030-12-31"];
  };

  const exportCount = (() => {
    const [from, to] = getExportFromTo();
    return entries.filter((e) => e.date >= from && e.date <= to).length;
  })();

  const runExport = () => {
    const [from, to] = getExportFromTo();
    const list = entries.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    const isTxt = exportFormat === "txt";
    const text = isTxt
      ? list
          .map((e) => `날짜: ${formatDateLabel(e.date)}${e.important ? " ★" : ""}${e.secret ? " 🔒" : ""}\n\n${e.content}\n\n`)
          .join("---\n\n")
      : list
          .map((e) => `## ${formatDateLabel(e.date)}${e.important ? " ★" : ""}${e.secret ? " 🔒" : ""}\n\n${e.content}\n\n`)
          .join("---\n\n");
    const blob = new Blob([text], { type: isTxt ? "text/plain;charset=utf-8" : "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `일기_${from}_${to}.${isTxt ? "txt" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const datesWithEntries = entryDatesWithContent;
  const lastDay = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=일
  const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const totalCells = 42;
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDayOfWeek || i >= firstDayOfWeek + lastDay) {
      calendarCells.push(null);
    } else {
      calendarCells.push(i - firstDayOfWeek + 1);
    }
  }

  return (
    <div className="min-w-0 space-y-4 pb-4 sm:space-y-6">
      {/* 저장 토스트 */}
      {saveToast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-neutral-800 px-5 py-3 text-sm font-semibold text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          저장됨 ✓
        </div>
      )}

      {/* 편집 모드: 글자 드래그 후 우클릭 메뉴 (글자색) */}
      {editContextMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60]"
              aria-hidden
              onClick={() => setEditContextMenu(null)}
            />
            <div
              ref={editContextMenuRef}
              className="fixed z-[61] min-w-[120px] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
              style={{ left: editContextMenu.x, top: editContextMenu.y }}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => applyEditColor("blue")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100"
              >
                <span className="h-3 w-3 rounded-full bg-[#3b82f6]" aria-hidden />
                파랑
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => applyEditColor("red")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100"
              >
                <span className="h-3 w-3 rounded-full bg-[#dc2626]" aria-hidden />
                빨강
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => applyEditColor("gray")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100"
              >
                <span className="h-3 w-3 rounded-full bg-[#6b7280]" aria-hidden />
                회색
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => applyEditColor("wave")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100"
              >
                <span className="text-neutral-500" style={{ textDecoration: "underline wavy" }} aria-hidden>
                  ∼∼
                </span>
                물결 밑줄
              </button>
            </div>
          </>,
          document.body
        )}

      {/* 비밀글 보기 암호 입력 모달 (블랙 디자인) */}
      {showUnlockModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" aria-hidden onClick={() => { setShowUnlockModal(false); setUnlockError(""); setUnlockPinValue(""); }} />
            <div
              className="relative w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-xl"
              role="dialog"
              aria-labelledby="unlock-pin-title"
              aria-modal="true"
            >
              <h2 id="unlock-pin-title" className="text-lg font-semibold text-white">비밀글 보기</h2>
              <p className="mt-1 text-sm text-neutral-400">설정한 암호를 입력하세요.</p>
              <div className="mt-4">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="암호 입력"
                  value={unlockPinValue}
                  onChange={(e) => {
                    setUnlockPinValue(e.target.value);
                    setUnlockError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (document.querySelector("[data-unlock-submit]") as HTMLButtonElement)?.click();
                    }
                  }}
                  className="w-full rounded-xl border border-neutral-600 bg-neutral-800 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
                {unlockError && <p className="mt-2 text-sm text-red-400">{unlockError}</p>}
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowUnlockModal(false); setUnlockError(""); setUnlockPinValue(""); }}
                  className="flex-1 rounded-xl border border-neutral-600 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
                >
                  취소
                </button>
                <button
                  data-unlock-submit
                  type="button"
                  onClick={async () => {
                    const stored = getStoredPinHash();
                    if (!stored) {
                      setUnlockError("설정된 암호가 없습니다.");
                      return;
                    }
                    const h = await hashPin(unlockPinValue);
                    if (h !== stored) {
                      setUnlockError("암호가 일치하지 않습니다.");
                      return;
                    }
                    setSecretUnlocked(true);
                    setShowUnlockModal(false);
                    setUnlockPinValue("");
                    setUnlockError("");
                  }}
                  className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  확인
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 모바일 전용: 모아보기 화면을 body에 풀스크린으로 띄움 (연도 클릭 시 무조건 보이게) */}
      {journalViewMode === "collect" && collectYear != null && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white overflow-auto md:hidden" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
            <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <button type="button" onClick={goBackToJournal} className="rounded-lg p-2 text-neutral-600 -ml-2 hover:bg-neutral-100" aria-label="일기장으로">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="flex-1 text-center font-semibold text-neutral-800">{collectYear}년 모아보기</span>
              <div className="w-9" />
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {entryDatesInYear.length === 0 ? (
                <div className="space-y-4 py-6">
                  <p className="text-sm text-neutral-500">이 연도에는 기록된 일기가 없어요.</p>
                  <select value={collectYear} onChange={(e) => goToCollectYear(Number(e.target.value))} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                    {yearOptions.map((y) => {
                      const count = entries.filter((e) => e.date.startsWith(String(y))).length;
                      return <option key={y} value={y}>{y}년 ({count}편)</option>;
                    })}
                  </select>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <button type="button" onClick={goPrevInCollect} disabled={!canGoPrevCollect} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-sm text-neutral-500">{collectIndex + 1} / {entryDatesInYear.length}</span>
                    <button type="button" onClick={goNextInCollect} disabled={!canGoNextCollect} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                  {entryDatesInYear.length > 1 && (
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-medium text-neutral-500">
                        이 연도 기록 한눈에 보기
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {entryDatesInYear.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSelectedDate(d)}
                            className={`flex flex-col rounded-lg border px-2 py-1.5 text-left text-xs ${
                              d === selectedDate
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            <span className="mb-0.5 text-[11px] font-medium opacity-70">
                              {formatDateLabel(d)}
                            </span>
                            <span className="line-clamp-2 text-[11px]">
                              {getCollectPreview(d) || "내용 없음"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-neutral-200 bg-[#FCFCFC] px-4 py-6">
                    <p className="mb-2 text-sm font-medium text-neutral-500">{formatDateLabel(selectedDate)}</p>
                    {entriesByDate[selectedDate]?.secret && !secretUnlocked ? (
                      <div className="py-12 text-center">
                        <p className="text-neutral-500 mb-4">비밀글로 설정된 일기입니다.</p>
                        {getStoredPinHash() ? (
                          <button type="button" onClick={() => { setShowUnlockModal(true); setUnlockPinValue(""); setUnlockError(""); }} className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white">암호 입력하여 보기</button>
                        ) : (
                          <button type="button" onClick={() => setShowSetPinInline(true)} className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white">암호 설정 후 보기</button>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-neutral min-w-0 text-[16px] leading-relaxed text-neutral-800 sm:text-[20px]" dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(entriesByDate[selectedDate]?.content ?? "") }} />
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => { goBackToJournal(); setViewMode("write"); }} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700">수정</button>
                    <span className="text-sm text-neutral-500">다른 연도:</span>
                    <select value={collectYear} onChange={(e) => goToCollectYear(Number(e.target.value))} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm">
                      {yearOptions.map((y) => {
                        const count = entries.filter((e) => e.date.startsWith(String(y))).length;
                        return <option key={y} value={y}>{y}년 ({count}편)</option>;
                      })}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* 모바일: 모아보기 연도 선택 모달 (sm 이상에서는 드롭다운만 사용) */}
      {yearDropdownOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center p-4 sm:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              aria-hidden
              onClick={() => setYearDropdownOpen(false)}
            />
            <div
              className="relative z-10 w-[min(280px,90vw)] rounded-2xl bg-white p-4 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="모아보기 연도 선택"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-sm font-medium text-neutral-500">연도 선택</p>
              <div className="max-h-[60vh] overflow-y-auto">
                {yearOptions.map((y) => {
                  const count = entries.filter((e) => e.date.startsWith(String(y))).length;
                  const href = `/journal?view=collect&year=${y}`;
                  return (
                    <a
                      key={y}
                      href={href}
                      onClick={(e) => {
                        e.preventDefault();
                        setYearDropdownOpen(false);
                        window.location.href = href;
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-medium text-neutral-800 transition hover:bg-neutral-100 no-underline"
                      style={{ minHeight: 48 }}
                    >
                      {y}년
                      <span className="text-sm font-normal text-neutral-400">{count}편</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className="-mb-4">
        <header className="mb-8 pt-4 pl-4 md:mb-10 md:pt-6 md:pl-6 !mb-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
              {journalViewMode === "collect" && collectYear != null ? `${collectYear}년 모아보기` : "일기장"}
            </h1>
            <div className="flex shrink-0 items-center gap-1 sm:hidden">
              {journalViewMode === "collect" ? (
                <button
                  type="button"
                  onClick={goBackToJournal}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800 text-white transition hover:bg-neutral-700"
                  aria-label="일기장으로"
                  title="일기장"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="달력·검색 열기"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              {journalViewMode === "journal" ? (
                <a
                  href="/journal?selectYear=1"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 touch-manipulation"
                  aria-label="모아보기"
                  title="모아보기"
                  onClick={(e) => {
                    e.preventDefault();
                    router.replace("/journal?selectYear=1", { scroll: true });
                  }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-sm text-neutral-500 md:text-lg">
            {journalViewMode === "collect" && collectYear != null ? "연도별로 모은 일기를 넘기며 볼 수 있어요." : "하루를 돌아보고, 차분하게 감정을 정리해요."}
          </p>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="flex items-center gap-1.5 text-sm text-neutral-500/30 md:text-neutral-500/60">
            {streak > 0 ? (
              <>
                <span aria-hidden>🔥</span>
                연속 <span className="font-semibold text-neutral-700">{streak}</span>일 작성 중
              </>
            ) : (
              <>
                마지막 기록: {lastRecordLabel ?? "—"}
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {journalViewMode === "collect" ? (
              <button
                type="button"
                onClick={goBackToJournal}
                className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:border-neutral-300 sm:flex"
                aria-label="일기장으로"
              >
                일기장
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="hidden shrink-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:border-neutral-300 sm:flex"
              aria-label="달력·검색 열기"
            >
              <svg className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              달력
            </button>
            <div className="relative hidden sm:block" ref={yearDropdownRef}>
              <button
                type="button"
                onClick={() => setYearDropdownOpen((o) => !o)}
                className={clsx(
                  "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition",
                  journalViewMode === "collect"
                    ? "border-neutral-800 bg-neutral-800 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
                )}
                aria-label="모아보기"
                aria-expanded={yearDropdownOpen}
              >
                모아보기
                <svg className={clsx("h-4 w-4 transition-transform", yearDropdownOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {yearDropdownOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[100%] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                  {yearOptions.map((y) => {
                    const count = entries.filter((e) => e.date.startsWith(String(y))).length;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => goToCollectYear(y)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                      >
                        {y}년
                        <span className="text-xs font-normal text-neutral-400">{count}편</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {journalLoading && (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      )}

      {/* 모바일용: 연도 선택 전용 페이지 (?selectYear=1) - 모달 없이 링크만 */}
      {selectYearOpen && (
        <Card className="min-w-0">
          <h2 className="text-xl font-semibold text-neutral-800 mb-4">연도 선택</h2>
          <p className="text-sm text-neutral-500 mb-4">볼 연도를 누르세요.</p>
          <ul className="space-y-2">
            {yearOptions.map((y) => {
              const count = entries.filter((e) => e.date.startsWith(String(y))).length;
              return (
                <li key={y}>
                  <a
                    href={`/journal?view=collect&year=${y}`}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-medium text-neutral-800 transition hover:bg-neutral-100 no-underline border border-neutral-200 touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      router.replace(`/journal?view=collect&year=${y}`, { scroll: true });
                    }}
                  >
                    {y}년
                    <span className="text-sm text-neutral-400">{count}편</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-6">
            <a href="/journal" className="inline-block rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 no-underline hover:bg-neutral-50">
              일기장으로
            </a>
          </div>
        </Card>
      )}

      <div className="min-w-0">
        {journalViewMode === "collect" && collectYear != null && !selectYearOpen && (
          <div ref={collectViewRef} className="min-w-0 hidden md:block">
            <Card className="min-w-0">
              {entryDatesInYear.length === 0 ? (
                <div className="space-y-4 py-6">
                  <h2 className="text-xl font-semibold text-neutral-800">{collectYear}년 모아보기</h2>
                  <p className="text-sm text-neutral-500">이 연도에는 기록된 일기가 없어요.</p>
                  <div className="flex items-center gap-2">
                    <label htmlFor="collect-year-empty-top" className="text-sm font-medium text-neutral-600">다른 연도:</label>
                    <select id="collect-year-empty-top" value={collectYear} onChange={(e) => goToCollectYear(Number(e.target.value))} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50">
                      {yearOptions.map((y) => {
                        const count = entries.filter((e) => e.date.startsWith(String(y))).length;
                        return <option key={y} value={y}>{y}년 ({count}편)</option>;
                      })}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="min-w-0 py-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-neutral-800">{collectYear}년 모아보기</h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={goPrevInCollect}
                        disabled={!canGoPrevCollect}
                        aria-label="이전 기록"
                        className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="min-w-[4rem] text-center text-sm text-neutral-500">
                        {collectIndex + 1} / {entryDatesInYear.length}
                      </span>
                      <button
                        type="button"
                        onClick={goNextInCollect}
                        disabled={!canGoNextCollect}
                        aria-label="다음 기록"
                        className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {collectMonths.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {collectMonths.map((m) => {
                        const isActive = effectiveCollectMonth === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setCollectMonth(m);
                              const firstInMonth = entryDatesInYear.find((d) => Number(d.split("-")[1]) === m);
                              if (firstInMonth) setSelectedDate(firstInMonth);
                            }}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                              isActive
                                ? "bg-neutral-900 text-white"
                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            {m}월
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {entryDatesInMonth.length > 0 && (
                    <div className="mb-4 max-h-64 overflow-y-auto pr-1">
                      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                        {entryDatesInMonth.map((d) => {
                          const [, m, day] = d.split("-");
                          const label = `${Number(m)}월 ${Number(day)}일`;
                          const isActive = d === selectedDate;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setSelectedDate(d)}
                              className={`flex flex-col rounded-lg border px-2 py-2 text-left text-xs ${
                                isActive
                                  ? "border-neutral-900 bg-neutral-900 text-white"
                                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
                              }`}
                            >
                              <span className="mb-0.5 text-[12px] font-semibold">
                                {label}
                              </span>
                              <span className="line-clamp-2 text-[12px] opacity-80">
                                {getCollectPreview(d) || "내용 없음"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-neutral-200 bg-[#FCFCFC] px-4 py-6 md:px-6">
                    <p className="mb-2 text-sm font-medium text-neutral-500">{formatDateLabel(selectedDate)}</p>
                    {entriesByDate[selectedDate]?.secret && !secretUnlocked ? (
                      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                        <p className="text-neutral-500">비밀글로 설정된 일기입니다.</p>
                        {getStoredPinHash() ? (
                          <button type="button" onClick={() => { setShowUnlockModal(true); setUnlockPinValue(""); setUnlockError(""); }} className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">암호 입력하여 보기</button>
                        ) : (
                          <button type="button" onClick={() => setShowSetPinInline(true)} className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">암호 설정 후 보기</button>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-neutral min-w-0 text-[16px] leading-relaxed text-neutral-800 sm:text-[20px]" dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(entriesByDate[selectedDate]?.content ?? "") }} />
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => { goBackToJournal(); setViewMode("write"); }} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:border-neutral-300">수정</button>
                    <span className="text-sm text-neutral-500">다른 연도:</span>
                    <select value={collectYear} onChange={(e) => goToCollectYear(Number(e.target.value))} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50">
                      {yearOptions.map((y) => {
                        const count = entries.filter((e) => e.date.startsWith(String(y))).length;
                        return <option key={y} value={y}>{y}년 ({count}편)</option>;
                      })}
                    </select>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        {journalViewMode === "journal" && !selectYearOpen && (
          <>
        <Card className="relative flex min-w-0 flex-col overflow-visible">
          {/* 한 줄: 좌우 화살표 · 날짜 · 오늘 버튼 (왼쪽) | 별 아이콘 (오른쪽) */}
          <div className="mb-3 flex flex-nowrap items-center justify-between gap-3 md:mb-6">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <div className="hidden md:flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={goPrevDay}
                  aria-label="어제"
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={goNextDay}
                  disabled={selectedDate >= todayStr()}
                  aria-label="다음날"
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <span className="shrink-0 text-lg font-semibold text-neutral-800">
                {formatDateLabel(selectedDate)}
              </span>
              {isToday ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[13px] font-medium text-emerald-800">
                  오늘
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr())}
                  className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-[13px] font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800"
                >
                  오늘로 이동
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0">
              <button
                type="button"
                onClick={() => setDraftImportant(!draftImportant)}
                className={clsx(
                  "p-1 text-xl transition",
                  draftImportant ? "text-orange-500" : "text-neutral-200 hover:text-orange-400"
                )}
                title="중요한 날"
                aria-label={draftImportant ? "중요한 날 해제" : "중요한 날로 표시"}
              >
                ★
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!draftSecret) {
                    setShowSetPinInline(true);
                    setSetPinValue("");
                    setSetPinConfirm("");
                    setSetPinError("");
                  } else {
                    setDraftSecret(false);
                  }
                }}
                className={clsx(
                  "p-1 text-lg transition",
                  draftSecret ? "text-neutral-600" : "text-neutral-200 hover:text-neutral-400"
                )}
                title="비밀글"
                aria-label={draftSecret ? "비밀글 해제" : "비밀글로 설정"}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
            </div>
          </div>

          {/* 비밀글 암호 설정 (인라인 - 블랙 디자인) */}
          {showSetPinInline && (
            <div className="mb-4 rounded-xl border border-neutral-700 bg-neutral-900 p-4">
              <p className="mb-3 font-medium text-white">비밀글 암호 설정</p>
              <p className="mb-3 text-sm text-neutral-400">숫자만 입력해도 됩니다. 비밀글 보기 시 이 암호를 입력하세요.</p>
              <div className="space-y-2">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="암호 입력"
                  value={setPinValue}
                  onChange={(e) => {
                    setSetPinValue(e.target.value);
                    setSetPinError("");
                  }}
                  className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="암호 다시 입력"
                  value={setPinConfirm}
                  onChange={(e) => {
                    setSetPinConfirm(e.target.value);
                    setSetPinError("");
                  }}
                  className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
                {setPinError && <p className="text-sm text-red-400">{setPinError}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSetPinInline(false);
                    setSetPinValue("");
                    setSetPinConfirm("");
                    setSetPinError("");
                  }}
                  className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!setPinValue.trim()) {
                      setSetPinError("암호를 입력하세요.");
                      return;
                    }
                    if (setPinValue !== setPinConfirm) {
                      setSetPinError("암호가 일치하지 않습니다.");
                      return;
                    }
                    const h = await hashPin(setPinValue);
                    setStoredPinHash(h);
                    setDraftSecret(true);
                    setShowSetPinInline(false);
                    setSetPinValue("");
                    setSetPinConfirm("");
                    setSetPinError("");
                    setViewMode("preview");
                    clearSecretUnlockedSession();
                    setSecretUnlocked(false);
                    const snap = { content: draft, important: draftImportant, secret: true };
                    saveDraft(selectedDate, snap);
                    saveJournalDraftToSupabase(selectedDate, snap).catch(() => {});
                    setEntries((prev) =>
                      prev.some((e) => e.date === selectedDate)
                        ? prev.map((e) => (e.date === selectedDate ? { ...e, secret: true } : e))
                        : prev
                    );
                  }}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  확인
                </button>
              </div>
            </div>
          )}

          {/* 초안 자동 저장 상태 */}
          <p className="mb-0.5 text-xs text-neutral-500 md:mb-1">
            {draftSaveStatus === "pending" && "2초 후 초안 자동 저장"}
            {draftSaveStatus === "saved" && "초안 자동 저장됨"}
            {draftSaveStatus === "idle" &&
              draft.trim() !== currentContent &&
              "저장 버튼을 눌러 일기에 반영하세요"}
          </p>

          {/* 본문 박스: 모바일에서만 화면 가로 꽉(full-bleed), PC는 카드 안 그대로 */}
          <div className="relative ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen md:ml-0 md:mr-0 md:w-full">
            <div className="px-4 pt-2 pb-4 md:px-0 md:pt-0 md:pb-0">
              <div className="relative">
                {/* 좌측 상단: 쓰기/미리보기 토글 */}
                <div className="absolute left-3 top-3 z-10">
                  <button
                    type="button"
                    onClick={() => setViewMode((m) => (m === "write" ? "preview" : "write"))}
                    title={viewMode === "write" ? "미리보기" : "편집"}
                    aria-label={viewMode === "write" ? "미리보기로 전환" : "편집으로 전환"}
                    className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                  >
                    {viewMode === "write" ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                  </button>
                </div>
                {(draftSecret || entryForDate?.secret) && !secretUnlocked ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-xl border border-neutral-200 bg-[#FCFCFC] py-12 text-center">
                    <p className="text-neutral-500">비밀글로 설정된 일기입니다.</p>
                    {getStoredPinHash() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUnlockModal(true);
                          setUnlockPinValue("");
                          setUnlockError("");
                        }}
                        className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
                      >
                        암호 입력하여 보기
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSetPinInline(true)}
                        className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
                      >
                        암호 설정 후 보기
                      </button>
                    )}
                  </div>
                ) : viewMode === "write" ? (
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                        e.preventDefault();
                        save();
                      }
                    }}
                    onContextMenu={(e) => {
                      const el = textareaRef.current;
                      if (!el) return;
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      if (start < end) {
                        e.preventDefault();
                        setEditContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          start,
                          end,
                        });
                      }
                    }}
                    placeholder="오늘 하루를 적어보세요. 볼드는 Ctrl+B(⌘+B)로 적용해요."
                    className="min-h-[560px] w-full resize-y rounded-xl border border-neutral-200 bg-[#FCFCFC] pt-14 pb-10 text-[16px] leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50 sm:text-[20px] md:pl-12 md:pr-10"
                    rows={20}
                  />
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setViewMode("write");
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setViewMode("write");
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }
                    }}
                    className="min-h-[360px] w-full cursor-text rounded-xl border border-neutral-200 bg-[#FCFCFC] px-4 pt-14 pb-10 text-[16px] leading-relaxed text-neutral-800 transition hover:border-neutral-300 sm:text-[20px] md:pl-12 md:pr-10"
                    title="클릭하면 글쓰기 모드로 전환"
                    aria-label="본문 영역. 클릭하면 편집 모드로 전환"
                  >
                    {draft.trim() ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(draft) }}
                      />
                    ) : (
                      <div className="space-y-2 text-neutral-400">
                        {getEmptyStatePrompt(selectedDate, entries)
                          .split("\n")
                          .map((line, i) => (
                            <p key={i} className="leading-relaxed">
                              {line}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* 모바일 전용: 이전/다음 날 버튼을 저장 옆에 */}
            <div className="flex md:hidden items-center gap-1">
              <button
                type="button"
                onClick={goPrevDay}
                aria-label="이전 날"
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNextDay}
                disabled={selectedDate >= todayStr()}
                aria-label="다음 날"
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <span className="relative inline-block">
              <button
                type="button"
                onClick={save}
                className="peer rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
              >
                {lastSaved ? "저장됨" : "저장"}
              </button>
              <span
                className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs text-white opacity-0 transition-[opacity,visibility] duration-75 peer-hover:visible peer-hover:opacity-100"
                role="tooltip"
              >
                저장 (Ctrl+S / ⌘+S)
              </span>
            </span>
            <button
              type="button"
              onClick={copyAndGo}
              disabled={!draft.trim()}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              맞춤법 검사
            </button>
            {entryForDate && (
              <button
                type="button"
                onClick={remove}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                삭제
              </button>
            )}
          </div>
        </Card>

        {/* 오늘 마음에 남은 문장 (인사이트): 기본 흐림, 호버·포커스 시 선명 */}
        <Card className="relative mt-10 min-w-0 space-y-4 bg-gradient-to-br from-white via-[#f5f5f7] to-white shadow-[0_18px_45px_rgba(0,0,0,0.08)] ring-1 ring-neutral-300 opacity-40 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 md:mt-12">
          <h2 className="text-xl font-semibold text-neutral-900">
            오늘 마음에 남은 문장
          </h2>
          <p className="text-sm text-neutral-500">
            책, 영상, 대화, 우연히 떠오른 생각까지. 한 줄씩만 남겨두면,
            나중에 다시 읽을 때 오늘의 나를 떠올릴 수 있어요.
          </p>
          <form onSubmit={handleInsightAdd} className="mt-2 space-y-3">
            <textarea
              value={insightInput}
              onChange={(e) => setInsightInput(e.target.value)}
              rows={3}
              placeholder=""
              className="w-full resize-none rounded-2xl border border-soft-border bg-white px-3.5 py-3 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 hover:border-neutral-400"
            />
            <input
              type="text"
              value={insightAuthorInput}
              onChange={(e) => setInsightAuthorInput(e.target.value)}
              placeholder="출처(인물명)"
              className="w-full rounded-2xl border border-soft-border bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 hover:border-neutral-400"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500">
              <span>
                {insightInput.trim().length > 0 ? `${insightInput.trim().length} 글자` : ""}
              </span>
              <div className="flex flex-nowrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  className="min-w-0 flex-[6] sm:flex-none sm:min-w-[10rem] rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
                >
                  인사이트 저장
                </button>
                <Link
                  href="/insight?tab=system"
                  className="min-w-0 flex-[4] sm:flex-none rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 text-center"
                >
                  문장 관리
                </Link>
              </div>
            </div>
          </form>
        </Card>
          </>
        )}

        {/* 드로어: 달력·검색·내보내기 (body에 포탈 → 화면 전체 어둡게, 오른쪽에서 슬라이드) */}
        {drawerOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-40 min-h-screen min-w-[100vw] bg-black/65 transition-opacity duration-200"
                aria-hidden
                onClick={() => setDrawerOpen(false)}
              />
              <aside
                className={clsx(
                  "fixed right-0 top-[12vh] z-50 flex h-[70vh] max-h-[75vh] w-[min(320px,92vw)] flex-col overflow-hidden rounded-l-2xl bg-white shadow-2xl transition-transform duration-200 ease-out",
                  "md:right-32 md:top-[24vh] md:h-[55vh] md:max-h-none md:w-[min(380px,90vw)] md:rounded-2xl",
                  drawerAnimated ? "translate-x-0" : "translate-x-full"
                )}
                role="dialog"
                aria-label="달력·검색"
              >
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <span className="text-sm font-semibold text-neutral-800">달력 · 검색</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="닫기"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="space-y-2">
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-0 flex h-full w-9 items-center justify-center text-neutral-400" aria-hidden>
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                    </span>
                    <input
                      type="search"
                      placeholder="일기에서 단어 검색"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                        {(showAllSearchResults ? searchResults : searchResults.slice(0, 6)).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSelectedDate(d)}
                            className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      {searchResults.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setShowAllSearchResults((v) => !v)}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
                        >
                          {showAllSearchResults ? "접기" : `더 보기 (+${searchResults.length - 6})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <Card className="h-fit !p-5 !pb-1">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <select
                      value={year}
                      onChange={(e) => setCalendarYear(Number(e.target.value))}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium text-neutral-800"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}년</option>
                      ))}
                    </select>
                    <select
                      value={month}
                      onChange={(e) => setCalendarMonth(Number(e.target.value))}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium text-neutral-800"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                        <option key={m} value={m}>{m}월</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-5">
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-neutral-400 sm:gap-2 sm:text-xs">
                      {weekLabels.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-1.5 sm:gap-2">
                      {calendarCells.map((day, i) => {
                        if (day === null) return <div key={i} className="aspect-square" />;
                        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const entry = entriesByDate[dateStr];
                        const hasEntry = !!(entry && entry.content.trim().length > 0);
                        const hasDraftForThisDate = dateStr === selectedDate && draft.trim().length > 0;
                        const isSecret = (hasEntry && entry!.secret) || (hasDraftForThisDate && draftSecret);
                        const showTooltip = hasEntry || hasDraftForThisDate;
                        const tooltipText = isSecret ? "🔒 비밀글" : hasEntry ? firstLinePreview(entry!.content, 80) : firstLinePreview(draft, 80);
                        const isImportant = entry?.important ?? false;
                        const isSelected = dateStr === selectedDate;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedDate(dateStr)}
                            onMouseEnter={(e) => {
                              if (!showTooltip || !tooltipText.trim()) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              setCellTooltip({ dateStr, text: tooltipText, x: rect.left + rect.width / 2, y: rect.top });
                            }}
                            onMouseLeave={() => setCellTooltip(null)}
                            className={clsx(
                              "relative aspect-square rounded-md text-sm transition sm:text-base",
                              isSelected ? "bg-neutral-800 font-semibold text-white" : isImportant ? "bg-orange-200 font-medium text-orange-900 hover:bg-orange-300" : hasEntry ? "bg-neutral-200 font-medium text-neutral-800 hover:bg-neutral-300" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                            )}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {cellTooltip && typeof document !== "undefined" && createPortal(
                    <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full rounded-lg bg-neutral-800 px-4 py-2.5 text-base text-white shadow-lg" style={{ left: cellTooltip.x, top: cellTooltip.y - 8, maxWidth: "min(320px, 90vw)" }}>
                      {cellTooltip.text}
                    </div>,
                    document.body
                  )}
                </Card>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowExport(!showExport)}
                    className="w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
                  >
                    내보내기
                  </button>
                  {showExport && (
                    <Card className="!p-4">
                      <p className="mb-3 text-sm font-semibold text-neutral-800">일기장 내보내기</p>
                      <p className="mb-3 text-xs text-neutral-500">연도와 범위를 선택한 뒤 내보내기를 누르세요.</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-500">연도</label>
                          <select
                            value={exportYear}
                            onChange={(e) => setExportYear(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                          >
                            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                              <option key={y} value={y}>{y}년</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-neutral-500">내보내기 범위</span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input type="radio" name="journalExportRange" checked={exportRangeType === "month"} onChange={() => setExportRangeType("month")} className="text-neutral-700" />
                              <span className="text-xs">특정 월</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input type="radio" name="journalExportRange" checked={exportRangeType === "year"} onChange={() => setExportRangeType("year")} className="text-neutral-700" />
                              <span className="text-xs">특정 연도</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input type="radio" name="journalExportRange" checked={exportRangeType === "range"} onChange={() => setExportRangeType("range")} className="text-neutral-700" />
                              <span className="text-xs">특정 기간</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input type="radio" name="journalExportRange" checked={exportRangeType === "all"} onChange={() => setExportRangeType("all")} className="text-neutral-700" />
                              <span className="text-xs">전부</span>
                            </label>
                          </div>
                        </div>
                        {exportRangeType === "month" && (
                          <div>
                            <label className="block text-xs font-medium text-neutral-500">월</label>
                            <select
                              value={exportMonth}
                              onChange={(e) => setExportMonth(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>{m}월</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {exportRangeType === "range" && (
                          <div>
                            <label className="block text-xs font-medium text-neutral-500">시작일 ~ 종료일</label>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <input type="date" value={exportRangeFrom} onChange={(e) => setExportRangeFrom(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm" />
                              <span className="text-neutral-400">~</span>
                              <input type="date" value={exportRangeTo} onChange={(e) => setExportRangeTo(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm" />
                            </div>
                          </div>
                        )}
                        {exportRangeType === "all" && (
                          <p className="text-xs text-neutral-600">저장된 전체 데이터를 내보냅니다.</p>
                        )}
                        <div>
                          <span className="block text-xs font-medium text-neutral-500">내보내기 형식</span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input type="radio" name="journalExportFormat" checked={exportFormat === "md"} onChange={() => setExportFormat("md")} className="text-neutral-700" />
                              <span className="text-xs">MD (마크다운)</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input type="radio" name="journalExportFormat" checked={exportFormat === "txt"} onChange={() => setExportFormat("txt")} className="text-neutral-700" />
                              <span className="text-xs">TXT (일반 텍스트)</span>
                            </label>
                          </div>
                        </div>
                        <p className="text-sm text-neutral-600"><strong>{exportCount}</strong>편 내보내기</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button type="button" onClick={runExport} className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">내보내기</button>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            </aside>
          </>,
            document.body
          )}
      </div>
    </div>
  );
}
