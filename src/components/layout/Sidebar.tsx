"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { House, CalendarDays, CircleCheck, NotebookText, Salad, Folder, SquarePlay, ChartNoAxesColumn, Coins, type LucideIcon } from "lucide-react";
import { SettingsModal } from "./SettingsModal";
import { SnippetsModal } from "./SnippetsModal";
import { YoutubePlayerBar } from "./YoutubePlayerBar";
import { ClockWidget } from "./ClockWidget";
import { loadScheduleEntries, getTodayCount } from "@/lib/scheduleDb";
import {
  SIDEBAR_MENU_ITEMS,
  SIDEBAR_MENU_CHANGED_EVENT,
  getHiddenSidebarMenus,
  getHiddenSubMenus,
  sidebarMenuTarget,
} from "@/lib/sidebarMenu";
import { USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";

const MENU_ICONS: Record<string, LucideIcon> = {
  "/": House,
  "/schedule": CalendarDays,
  "/routine/list": CircleCheck,
  "/memo": NotebookText,
  "/diet": Salad,
  "/projects": Folder,
  "/youtube": SquarePlay,
  "/finance": ChartNoAxesColumn,
  "/income": Coins,
};

interface SidebarProps {
  /** 모바일에서 메뉴 클릭 후 드로어 닫기용 */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [scheduleBadge, setScheduleBadge] = useState(0);
  const [hiddenMenus, setHiddenMenus] = useState<string[]>([]);
  /** 꺼 둔 하위 메뉴. 메뉴를 누르면 켜져 있는 첫 하위 메뉴로 간다 */
  const [hiddenSubMenus, setHiddenSubMenus] = useState<string[]>([]);

  // 설정에서 끈 메뉴는 목록에서 뺌
  useEffect(() => {
    const sync = () => {
      setHiddenMenus(getHiddenSidebarMenus());
      setHiddenSubMenus(getHiddenSubMenus());
    };
    sync();
    window.addEventListener(SIDEBAR_MENU_CHANGED_EVENT, sync);
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SIDEBAR_MENU_CHANGED_EVENT, sync);
      window.removeEventListener(USER_SETTINGS_SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const refreshScheduleBadge = () => {
    loadScheduleEntries().then((entries) => setScheduleBadge(getTodayCount(entries)));
  };
  useEffect(() => {
    refreshScheduleBadge();
    window.addEventListener("schedule-changed", refreshScheduleBadge);
    return () => window.removeEventListener("schedule-changed", refreshScheduleBadge);
  }, []);

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto rounded-3xl bg-white/80 px-5 py-4 md:max-xl:overflow-x-hidden md:max-xl:px-2 md:max-xl:py-3 shadow-[0_18px_50px_rgba(0,0,0,0.08)] ring-1 ring-white/60 backdrop-blur-2xl">
      <div className="mb-8 ml-1 px-1 md:max-xl:mb-4 md:max-xl:ml-0 md:max-xl:px-0">
        <ClockWidget />
      </div>

      <nav className="space-y-2 md:max-xl:space-y-1">
        {SIDEBAR_MENU_ITEMS.filter((item) => !hiddenMenus.includes(item.href)).map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.exact
                ? pathname === item.href
                : item.activePrefixes
                  ? item.activePrefixes.some((p) => pathname.startsWith(p))
                  : pathname.startsWith(item.href);
          const showBadge = item.badge && scheduleBadge > 0;
          const Icon = MENU_ICONS[item.href] ?? House;

          return (
            <Link
              key={item.href}
              href={sidebarMenuTarget(item, hiddenSubMenus)}
              onClick={onNavigate}
              className={clsx(
                "group flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-3 text-[17px] font-medium tracking-tight transition-all sm:min-h-0 sm:px-6 md:max-xl:rounded-xl md:max-xl:pl-3 md:max-xl:pr-1 md:max-xl:py-2 md:max-xl:text-[15px]",
                active
                  ? "bg-neutral-900 text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)]"
                  : "text-neutral-600 hover:bg-neutral-100 hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
              )}
            >
              <span className="flex items-center gap-3 md:max-xl:gap-2">
                <Icon className="h-5 w-5 shrink-0 md:max-xl:hidden" strokeWidth={1.8} aria-hidden />
                {item.label}
                {showBadge && (
                  <span className="grid h-5 min-w-[1.25rem] flex-shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold tabular-nums leading-none text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.25)]">
                    {scheduleBadge > 99 ? "99+" : scheduleBadge}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      <YoutubePlayerBar />
      <div className="mt-auto flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center rounded-2xl px-4 py-3 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 md:max-xl:px-2"
          aria-label="설정"
          title="설정"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setSnippetsOpen(true)}
          className="flex items-center justify-center rounded-2xl px-4 py-3 text-neutral-500 transition hover:bg-sky-50 hover:text-sky-600 md:max-xl:px-2"
          aria-label="빠른 복사"
          title="빠른 복사"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {snippetsOpen && <SnippetsModal onClose={() => setSnippetsOpen(false)} />}
    </aside>
  );
}

