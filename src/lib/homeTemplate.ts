/**
 * 홈 화면 템플릿 설정 (기기 간 동기화)
 * - basic: 현재 디자인 (날씨/메모/투데이 인사이트 + 수면/루틴/현재 할일)
 * - video: 투데이 인사이트·현재 할일 대신 세로 영상 플레이어
 */

import { loadSetting, saveSetting } from "./userSettings";

const HOME_TEMPLATE_KEY = "home-template";

export const HOME_TEMPLATE_CHANGED_EVENT = "home-template-changed";

export type HomeTemplateId = "basic" | "video" | "calendar";

export const HOME_TEMPLATE_OPTIONS: { id: HomeTemplateId; label: string; description: string }[] = [
  {
    id: "basic",
    label: "기본 템플릿",
    description: "날씨 · 메모 · 투데이 인사이트 · 수면 · 루틴 · 현재 할일",
  },
  {
    id: "video",
    label: "영상 템플릿",
    description: "투데이 인사이트·현재 할일 자리에 세로 영상 플레이어 (인사이트/운동/기타)",
  },
  {
    id: "calendar",
    label: "달력 템플릿",
    description: "날씨(낮게) · 메모 아래에 월간 달력 (날짜별 일정 한눈에). 인사이트·수면·루틴·현재 할일은 빠져요",
  },
];

export function getHomeTemplate(): HomeTemplateId {
  const v = loadSetting<string>(HOME_TEMPLATE_KEY, "basic");
  return v === "video" || v === "calendar" ? v : "basic";
}

export function setHomeTemplate(id: HomeTemplateId): void {
  if (typeof window === "undefined") return;
  saveSetting(HOME_TEMPLATE_KEY, id);
  window.dispatchEvent(new CustomEvent(HOME_TEMPLATE_CHANGED_EVENT));
}

/** 홈 메모 카드 디자인 */
export type MemoCardStyle = "classic" | "card" | "tasks";

const MEMO_CARD_STYLE_KEY = "home-memo-card-style";

export const MEMO_CARD_STYLE_CHANGED_EVENT = "home-memo-card-style-changed";

export const MEMO_CARD_STYLE_OPTIONS: { id: MemoCardStyle; label: string; description: string }[] = [
  { id: "classic", label: "기본 (노란 상단)", description: "노란 상단에 날짜, 흰 본문. 이전/다음 화살표" },
  { id: "card", label: "카드형", description: "흰 카드에 굵은 제목, 아래로 흐려지는 본문. ··· 메뉴에서 이전/다음 메모" },
  { id: "tasks", label: "노란 카드형", description: "노란 카드 안 흰 패널에 제목과 메모 본문. 아래 노란 띠에서 전체 보기·이전/다음" },
];

export function getMemoCardStyle(): MemoCardStyle {
  const v = loadSetting<string>(MEMO_CARD_STYLE_KEY, "classic");
  return v === "card" || v === "tasks" ? v : "classic";
}

export function setMemoCardStyle(style: MemoCardStyle): void {
  if (typeof window === "undefined") return;
  saveSetting(MEMO_CARD_STYLE_KEY, style);
  window.dispatchEvent(new CustomEvent(MEMO_CARD_STYLE_CHANGED_EVENT));
}

/** 홈 상단 알림바 표시 여부 (기본 켜짐) */
const ALERT_BAR_ENABLED_KEY = "home-alert-bar-enabled";

export const ALERT_BAR_ENABLED_CHANGED_EVENT = "home-alert-bar-enabled-changed";

export function getAlertBarEnabled(): boolean {
  return loadSetting<boolean>(ALERT_BAR_ENABLED_KEY, true) !== false;
}

export function setAlertBarEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  saveSetting(ALERT_BAR_ENABLED_KEY, enabled);
  window.dispatchEvent(new CustomEvent(ALERT_BAR_ENABLED_CHANGED_EVENT));
}
