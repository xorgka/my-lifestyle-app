"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { SettingsModal } from "./SettingsModal";

const menuItems = [
  { href: "/", label: "홈" },
  { href: "/routine", label: "루틴" },
  { href: "/journal", label: "일기장" },
  { href: "/insight", label: "인사이트" },
  { href: "/youtube", label: "유튜브" },
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

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto rounded-3xl bg-white/80 px-5 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] ring-1 ring-white/60 backdrop-blur-2xl">
      <div className="mb-12 px-1">
        <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          MY LIFESTYLE
        </div>
        <div className="mt-3 text-[1.7rem] font-semibold tracking-tight text-neutral-900">
          올인원
          <br />
          대시보드
        </div>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "group flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[16px] font-medium tracking-tight transition-all",
                active
                  ? "bg-neutral-900 text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)]"
                  : "text-neutral-600 hover:bg-neutral-100 hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
              )}
            >
              <span>{item.label}</span>
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

      <div className="mt-auto border-t border-neutral-100 pt-4 flex justify-start">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-start rounded-2xl px-4 py-3 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="설정"
          title="설정"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}

