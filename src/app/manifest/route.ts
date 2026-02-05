import { NextResponse } from "next/server";

/**
 * PWA manifest. NEXT_PUBLIC_FAVICON_URL 이 있으면 해당 URL을 앱 아이콘으로 사용.
 * (홈 화면 추가 시 파비콘과 동일한 아이콘이 보이도록)
 */
export function GET() {
  const faviconUrl = process.env.NEXT_PUBLIC_FAVICON_URL;
  const iconType = faviconUrl?.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
  const icons = faviconUrl
    ? [
        { src: faviconUrl, sizes: "any", type: iconType, purpose: "any" as const },
        { src: faviconUrl, sizes: "192x192", type: iconType, purpose: "any maskable" as const },
        { src: faviconUrl, sizes: "512x512", type: iconType, purpose: "any maskable" as const },
      ]
    : [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" as const },
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" as const },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" as const },
      ];

  const manifest = {
    name: "My Lifestyle Dashboard",
    short_name: "Lifestyle",
    description: "애플 스타일 올인원 라이프스타일 대시보드",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#1a1a1a",
    background_color: "#F8F8FA",
    lang: "ko",
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
