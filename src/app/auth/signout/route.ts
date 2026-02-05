import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** 세션 제거 후 redirect 파라미터로 리다이렉트 (권한 없음 시 로그아웃 후 로그인 페이지로) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/login";

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
