"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 기본 문장 관리는 인사이트 페이지의 "기본 문장" 탭으로 통합됨. 기존 URL은 리다이렉트. */
export default function InsightSystemPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/insight?tab=system");
  }, [router]);
  return (
    <p className="min-w-0 py-8 text-center text-sm text-neutral-500">
      기본 문장 관리로 이동 중…
    </p>
  );
}
