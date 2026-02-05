import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** Client Components에서 사용하는 Supabase 클라이언트 (쿠키 기반 세션) */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
