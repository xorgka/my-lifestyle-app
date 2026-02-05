"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "./DashboardShell";

/** 로그인/회원가입·auth 콜백에서는 대시보드 shell 없이 children만 렌더 */
export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname?.startsWith("/auth");

  if (isAuthPage) {
    return <>{children}</>;
  }
  return <DashboardShell>{children}</DashboardShell>;
}
