import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** NEXT_PUBLIC_SUPABASE_URL이 있을 때만 Supabase 사용 (배포 환경에서 설정 필수) */
export const isSupabaseConfigured =
  typeof supabaseUrl === "string" && supabaseUrl.length > 0 && typeof supabaseAnonKey === "string" && supabaseAnonKey.length > 0;

/** 브라우저/클라이언트에서 사용하는 Supabase 클라이언트 (Anon Key 사용). URL 없으면 null */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
