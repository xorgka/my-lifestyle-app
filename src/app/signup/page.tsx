"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 회원가입 비공개: 로그인으로 리다이렉트 (계정은 Supabase 대시보드에서만 생성) */
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
