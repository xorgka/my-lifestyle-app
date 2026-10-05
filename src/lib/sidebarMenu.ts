/**
 * 사이드바 메뉴 목록과 메뉴별 표시 여부 (기기 간 동기화)
 * 설정에서 끈 메뉴는 사이드바에서 빠진다. 홈은 항상 표시.
 * 하위 메뉴(노트 안의 메모·노트·일기장 등)도 따로 끌 수 있고, 끄면 페이지 제목의 형제 링크에서 빠진다.
 */

import { loadSetting, saveSetting } from "./userSettings";

/** 메뉴 안의 하위 페이지 (페이지 제목 자리에 "메모 · 노트 · 일기장"처럼 나오는 것) */
export type SidebarSubMenu = { href: string; label: string };

export type SidebarMenuItem = {
  href: string;
  label: string;
  /** 하위 메뉴. 설정에서 하나씩 끌 수 있다 (적어도 하나는 남아야 함) */
  children?: SidebarSubMenu[];
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
  {
    href: "/routine/list",
    label: "루틴",
    activePrefixes: ["/routine"],
    children: [
      { href: "/routine/list", label: "루틴" },
      { href: "/routine", label: "일과" },
      { href: "/routine/sleep", label: "수면" },
    ],
  },
  {
    href: "/memo",
    label: "노트",
    activePrefixes: ["/memo", "/journal"],
    children: [
      { href: "/memo", label: "메모" },
      { href: "/memo/note", label: "노트" },
      { href: "/journal", label: "일기장" },
    ],
  },
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

/** 하위 메뉴는 같은 목록에 이 접두사를 붙여 저장한다 ("/memo"처럼 메뉴와 하위 메뉴의 주소가 같은 경우가 있어서) */
const SUB_PREFIX = "sub:";

/** 저장된 숨김 목록 그대로 (메뉴 href + "sub:" 붙은 하위 메뉴 href) */
function loadHiddenRaw(): string[] {
  const v = loadSetting<unknown>(HIDDEN_MENUS_KEY, []);
  if (!Array.isArray(v)) return [];
  return v.filter((href): href is string => typeof href === "string" && href !== ALWAYS_VISIBLE_MENU_HREF);
}

function saveHiddenRaw(list: string[]): void {
  saveSetting(HIDDEN_MENUS_KEY, list);
  window.dispatchEvent(new CustomEvent(SIDEBAR_MENU_CHANGED_EVENT));
}

/** 숨긴 메뉴의 href 목록 */
export function getHiddenSidebarMenus(): string[] {
  return loadHiddenRaw().filter((href) => !href.startsWith(SUB_PREFIX));
}

export function setSidebarMenuVisible(href: string, visible: boolean): void {
  if (typeof window === "undefined" || href === ALWAYS_VISIBLE_MENU_HREF) return;
  const hidden = loadHiddenRaw().filter((h) => h !== href);
  if (!visible) hidden.push(href);
  saveHiddenRaw(hidden);
}

/** 숨긴 하위 메뉴의 href 목록 */
export function getHiddenSubMenus(): string[] {
  return loadHiddenRaw()
    .filter((href) => href.startsWith(SUB_PREFIX))
    .map((href) => href.slice(SUB_PREFIX.length));
}

/** 하위 메뉴 켜고 끄기. 그 메뉴의 하위 메뉴가 하나만 남았으면 끄지 않는다 */
export function setSubMenuVisible(href: string, visible: boolean): void {
  if (typeof window === "undefined") return;
  const key = SUB_PREFIX + href;
  const hidden = loadHiddenRaw().filter((h) => h !== key);
  if (!visible) {
    const parent = SIDEBAR_MENU_ITEMS.find((m) => m.children?.some((c) => c.href === href));
    const stillVisible = (parent?.children ?? []).filter((c) => c.href !== href && !hidden.includes(SUB_PREFIX + c.href));
    if (stillVisible.length === 0) return;
    hidden.push(key);
  }
  saveHiddenRaw(hidden);
}

/** 메뉴를 눌렀을 때 갈 곳: 하위 메뉴가 있으면 켜져 있는 첫 번째 하위 메뉴 */
export function sidebarMenuTarget(item: SidebarMenuItem, hiddenSubMenus: string[]): string {
  return item.children?.find((c) => !hiddenSubMenus.includes(c.href))?.href ?? item.href;
}
