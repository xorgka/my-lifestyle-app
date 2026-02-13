"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { SettingsModal } from "./SettingsModal";
import { SnippetsModal } from "./SnippetsModal";
import { YoutubePlayerBar } from "./YoutubePlayerBar";
import { ClockWidget } from "./ClockWidget";
import { loadScheduleEntries, getTodayCount } from "@/lib/scheduleDb";

const menuItems = [
  { href: "/", label: "홈" },
  { href: "/schedule", label: "스케줄", badge: true },
  { href: "/routine", label: "루틴" },
  { href: "/memo", label: "메모" },
  { href: "/journal", label: "일기장" },
  { href: "/youtube", label: "유튜브", exact: true },
  { href: "/finance", label: "가계부" },
  { href: "/income", label: "수입" },
];

interface SidebarProps {
  /** 모바일에서 메뉴 클릭 후 드로어 닫기용 */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [scheduleBadge, setScheduleBadge] = useState(0);

  const refreshScheduleBadge = () => {
    loadScheduleEntries().then((entries) => setScheduleBadge(getTodayCount(entries)));
  };
  useEffect(() => {
    refreshScheduleBadge();
    window.addEventListener("schedule-changed", refreshScheduleBadge);
    return () => window.removeEventListener("schedule-changed", refreshScheduleBadge);
  }, []);

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto rounded-3xl bg-white/80 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.08)] ring-1 ring-white/60 backdrop-blur-2xl">
      <div className="mb-8 ml-1 px-1">
        <ClockWidget />
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : "exact" in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
          const showBadge = "badge" in item && item.badge && scheduleBadge > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "group flex min-h-[44px] items-center justify-between gap-2 rounded-2xl px-5 py-3 text-[17px] font-medium tracking-tight transition-all sm:min-h-0 sm:px-6",
                active
                  ? "bg-neutral-900 text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)]"
                  : "text-neutral-600 hover:bg-neutral-100 hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
              )}
            >
              <span className="flex items-center gap-2">
                {item.label}
                {showBadge && (
                  <span className="grid h-5 min-w-[1.25rem] flex-shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold tabular-nums leading-none text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.25)]">
                    {scheduleBadge > 99 ? "99+" : scheduleBadge}
                  </span>
                )}
              </span>
              <span
                className={clsx(
                  "text-xs transition-transform",
                  active ? "translate-x-0.5" : "translate-x-0"
                )}
              >
                ⌘
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
          className="flex items-center justify-center rounded-2xl px-4 py-3 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
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
          className="flex items-center justify-center rounded-2xl px-4 py-3 text-neutral-500 transition hover:bg-sky-50 hover:text-sky-600"
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

