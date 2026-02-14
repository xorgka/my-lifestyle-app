"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";

/** 로그인/회원가입·auth 콜백에서는 대시보드 shell 없이 children만 렌더 */
export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname?.startsWith("/auth");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const inInput = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
      if (e.key === "Home") {
        if (inInput) return;
        e.preventDefault();
        router.push("/");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        if (inInput) return;
        e.preventDefault();
        router.push("/memo/note");
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  if (isAuthPage) {
    return <>{children}</>;
  }
  return <DashboardShell>{children}</DashboardShell>;
}
