"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const m = () => setMobile(typeof window !== "undefined" && window.innerWidth < 768);
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);
  return mobile;
}
import { EveningFaceReminderPopup } from "@/components/EveningFaceReminderPopup";
import { GymReminderPopup } from "@/components/GymReminderPopup";
import { MorningFaceReminderPopup } from "@/components/MorningFaceReminderPopup";
import { ShowerReminderPopup } from "@/components/ShowerReminderPopup";
import { WakeTimePopup } from "@/components/WakeTimePopup";
import { YoutubeUploadReminderPopup } from "@/components/YoutubeUploadReminderPopup";
import { CustomReminderPopups } from "@/components/CustomReminderPopups";
import { syncPopupConfigFromSupabase } from "@/lib/popupReminderConfig";
import { isSupabaseConfigured } from "@/lib/supabase";

const TEST_ALERTS_KEY = "testAlerts";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [forceShowWakePopup, setForceShowWakePopup] = useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (pathname !== "/" || typeof window === "undefined") return;
    if (sessionStorage.getItem(TEST_ALERTS_KEY) === "1") {
      sessionStorage.removeItem(TEST_ALERTS_KEY);
      setForceShowWakePopup(true);
    }
  }, [pathname]);

  // 팝업 설정 Supabase 동기화 (모바일·기기·브라우저 간 연동). 동기화 완료 후 리렌더해 최신 설정 반영
  const [, setPopupConfigVersion] = useState(0);
  useEffect(() => {
    syncPopupConfigFromSupabase().then(() => setPopupConfigVersion((v) => v + 1));
  }, []);

  return (
    <div lang="ko" className="min-h-screen bg-gradient-to-br from-soft-bg via-[#F8F8FA] to-soft-bg px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-5 md:px-10 md:pt-10 md:pb-4">
      <ShowerReminderPopup />
      <MorningFaceReminderPopup />
      <EveningFaceReminderPopup />
      <GymReminderPopup />
      <YoutubeUploadReminderPopup />
      <WakeTimePopup forceShow={forceShowWakePopup} />
      <CustomReminderPopups />
      {/* 모바일: 상단 바 (홈 + 메뉴), safe-area·터치 영역 44px */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-2 md:hidden [padding-top:max(0.5rem,env(safe-area-inset-top))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-neutral-500/15 hover:text-neutral-500/40"
          aria-label="홈"
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-white/90 shadow-lg ring-1 ring-black/5 backdrop-blur-xl"
          aria-label="메뉴 열기"
        >
          <svg className="h-5 w-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* 모바일 전용: 메뉴 드로어. 닫아도 DOM 유지해 플레이리스트 재생이 끊기지 않게 함 (Sidebar는 1개만) */}
      {isMobile && (
        <>
          <div
            className={`fixed inset-0 z-40 min-h-[100dvh] min-w-[100vw] bg-black/65 transition-opacity duration-200 ${
              mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
          <div
            className={`fixed left-0 top-0 z-50 h-full w-[min(85vw,280px)] overflow-y-auto rounded-r-3xl bg-white/95 shadow-xl backdrop-blur-2xl transition-transform duration-200 ease-out ${
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            aria-hidden={!mobileMenuOpen}
          >
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}

      <div className="mx-auto flex w-full max-w-7xl gap-7">
        {/* 데스크톱에만 사이드바 컬럼 (모바일은 드로어에 Sidebar 있음 → 플레이어 1개만) */}
        {!isMobile && (
          <div className="sticky top-6 h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] w-64 self-start">
            <Sidebar />
          </div>
        )}
        <main className="min-w-0 flex-1 pt-14 md:pt-0 [padding-bottom:env(safe-area-inset-bottom)]">
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:px-5 md:py-4">
              <p className="font-semibold">기기·브라우저 연동이 꺼져 있어요</p>
              <p className="mt-1 text-amber-800">
                지금은 이 브라우저에만 데이터가 저장됩니다. 크롬·웨일·스마트폰 등에서 같은 데이터를 보려면 Supabase를 설정해 주세요.
              </p>
              <p className="mt-2 text-xs text-amber-700">
                1) Supabase 프로젝트 생성 → 2) 프로젝트 루트에 <code className="rounded bg-amber-100 px-1">.env.local</code> 파일 만들고{" "}
                <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
                <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 입력 (예시: .env.local.example 참고) → 3) Supabase SQL Editor에서 supabase/schema.sql 실행 → 4) 개발 서버 재시작
              </p>
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-white/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.06)] ring-1 ring-white/40 backdrop-blur-xl md:gap-6 md:rounded-3xl md:px-8 md:pt-8 md:pb-4 sm:p-5 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] md:[padding-bottom:1rem]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

