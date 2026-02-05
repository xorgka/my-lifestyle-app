"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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

      <div className="mt-auto border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[16px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}

