/**
 * 사이드바 메뉴 목록과 메뉴별 표시 여부 (기기 간 동기화)
 * 설정에서 끈 메뉴는 사이드바에서 빠진다. 홈은 항상 표시.
 */

import { loadSetting, saveSetting } from "./userSettings";

export type SidebarMenuItem = {
  href: string;
  label: string;
  /** 오늘 일정 개수 배지 */
  badge?: boolean;
  /** 경로가 정확히 같을 때만 활성 */
  exact?: boolean;
  /** 이 경로들로 시작하면 활성 */
  activePrefixes?: string[];
};

export const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { href: "/", label: "홈" },
  { href: "/schedule", label: "스케줄", badge: true },
  { href: "/routine/list", label: "루틴", activePrefixes: ["/routine"] },
  { href: "/memo", label: "노트", activePrefixes: ["/memo", "/journal"] },
  { href: "/diet", label: "다이어트" },
  { href: "/projects", label: "프로젝트" },
  { href: "/youtube", label: "유튜브", exact: true },
  { href: "/finance", label: "가계부" },
  { href: "/income", label: "수입" },
];

/** 끌 수 없는 메뉴 */
export const ALWAYS_VISIBLE_MENU_HREF = "/";

const HIDDEN_MENUS_KEY = "sidebar-hidden-menus";

export const SIDEBAR_MENU_CHANGED_EVENT = "sidebar-menu-changed";

/** 숨긴 메뉴의 href 목록 */
export function getHiddenSidebarMenus(): string[] {
  const v = loadSetting<unknown>(HIDDEN_MENUS_KEY, []);
  if (!Array.isArray(v)) return [];
  return v.filter((href): href is string => typeof href === "string" && href !== ALWAYS_VISIBLE_MENU_HREF);
}

export function setSidebarMenuVisible(href: string, visible: boolean): void {
  if (typeof window === "undefined" || href === ALWAYS_VISIBLE_MENU_HREF) return;
  const hidden = getHiddenSidebarMenus().filter((h) => h !== href);
  if (!visible) hidden.push(href);
  saveSetting(HIDDEN_MENUS_KEY, hidden);
  window.dispatchEvent(new CustomEvent(SIDEBAR_MENU_CHANGED_EVENT));
}
