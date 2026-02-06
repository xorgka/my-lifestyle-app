"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div lang="ko" className="min-h-screen bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-2 pt-3 pb-5 md:px-10 md:py-10 sm:px-4 sm:pt-4 sm:pb-7">
      {/* 모바일: 상단 바 (홈 + 메뉴) */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-1.5 md:hidden">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center text-neutral-500/15 hover:text-neutral-500/40"
          aria-label="홈"
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 shadow-lg ring-1 ring-black/5 backdrop-blur-xl"
          aria-label="메뉴 열기"
        >
          <svg className="h-5 w-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* 모바일: 메뉴 드로어 (오버레이) */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
          <div className="fixed left-0 top-0 z-50 h-full w-[min(85vw,280px)] overflow-y-auto rounded-r-3xl bg-white/95 shadow-xl backdrop-blur-2xl md:hidden">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}

      <div className="mx-auto flex w-full max-w-7xl gap-7">
        <div className="sticky top-10 hidden h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)] md:block md:w-64 md:self-start">
          <Sidebar />
        </div>
        <main className="min-w-0 flex-1 pt-12 md:pt-0">
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-white/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.06)] ring-1 ring-white/40 backdrop-blur-xl md:gap-6 md:rounded-3xl md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

