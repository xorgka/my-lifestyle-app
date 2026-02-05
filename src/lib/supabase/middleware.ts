import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** 세션 갱신 후, 비로그인 사용자는 로그인 페이지로 리다이렉트 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value }) =>
          supabaseResponse.cookies.set(name, value)
        );
      },
    },
  });

  // 서버에서는 getClaims()로 JWT 검증 (getSession/getUser는 스푸핑 가능)
  const { data } = await supabase.auth.getClaims();
  const hasSession = !!data?.claims;
  const claims = data?.claims as { email?: string } | undefined;
  const userEmail = claims?.email?.trim().toLowerCase();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth");

  // /signup 접근 시 로그인으로 (회원가입은 대시보드에서만)
  if (request.nextUrl.pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 허용 이메일 목록이 있으면 본인만 접근 가능 (나만 보기)
  const allowedEmailsRaw = process.env.ALLOWED_EMAILS ?? process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? "";
  const allowedEmails = allowedEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (hasSession && allowedEmails.length > 0 && userEmail && !allowedEmails.includes(userEmail)) {
    const redirect = `/login?message=access_denied`;
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signout";
    url.searchParams.set("redirect", redirect);
    return NextResponse.redirect(url);
  }

  if (hasSession && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
