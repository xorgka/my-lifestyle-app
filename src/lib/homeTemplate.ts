/**
 * 홈 화면 템플릿 설정 (기기 간 동기화)
 * - basic: 현재 디자인 (날씨/메모/투데이 인사이트 + 수면/루틴/현재 할일)
 * - video: 투데이 인사이트·현재 할일 대신 세로 영상 플레이어
 */

import { loadSetting, saveSetting } from "./userSettings";

const HOME_TEMPLATE_KEY = "home-template";

export const HOME_TEMPLATE_CHANGED_EVENT = "home-template-changed";

export type HomeTemplateId = "basic" | "video";

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
];

export function getHomeTemplate(): HomeTemplateId {
  return loadSetting<string>(HOME_TEMPLATE_KEY, "basic") === "video" ? "video" : "basic";
}

export function setHomeTemplate(id: HomeTemplateId): void {
  if (typeof window === "undefined") return;
  saveSetting(HOME_TEMPLATE_KEY, id);
  window.dispatchEvent(new CustomEvent(HOME_TEMPLATE_CHANGED_EVENT));
}
