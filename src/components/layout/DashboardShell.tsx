"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-4 py-7 md:px-10 md:py-10">
      {/* 모바일: 상단 메뉴 버튼 */}
      <div className="fixed right-4 top-4 z-50 md:hidden">
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
            <div className="relative pt-14">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100"
                aria-label="메뉴 닫기"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        </>
      )}

      <div className="mx-auto flex w-full max-w-7xl gap-7">
        <div className="sticky top-10 hidden h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)] md:block md:w-64 md:self-start">
          <Sidebar />
        </div>
        <main className="min-w-0 flex-1 pt-12 md:pt-0">
          <div className="flex min-w-0 flex-col gap-4 rounded-3xl bg-white/80 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] ring-1 ring-white/40 backdrop-blur-xl md:gap-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

