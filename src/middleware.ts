import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로:
     * - _next/static, _next/image, favicon.ico, 정적 이미지
     * - PWA 파일(manifest, sw.js): 브라우저가 쿠키 없이 받아 가서, 로그인으로 넘기면 앱 설치가 안 된다
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest$|manifest\\.json$|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
