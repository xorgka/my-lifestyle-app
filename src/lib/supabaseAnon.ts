import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** 배포 환경 변수 (anon 또는 publishable) */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabaseAnonOrPublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  );
}

/**
 * 쿠키/세션 없이 anon 키만 쓰는 클라이언트.
 * 휴대폰·Tasker 등 외부에서 호출하는 API 라우트에서 세션 클라이언트와 혼동되지 않도록 사용.
 */
export function createSupabaseAnonClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonOrPublishableKey();
  if (!url || !key) return null;
  return createClient(url, key);
}
