import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { RegisterServiceWorker } from "@/components/layout/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "My Lifestyle Dashboard",
  description: "애플 스타일 올인원 라이프스타일 대시보드",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lifestyle",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1a1a",
};

const faviconUrl = process.env.NEXT_PUBLIC_FAVICON_URL || "/icon.svg";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta httpEquiv="Content-Language" content="ko" />
        <link rel="icon" href={faviconUrl} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="apple-touch-icon" href={faviconUrl} />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body lang="ko" className="bg-soft-bg font-sans antialiased">
        <RegisterServiceWorker />
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}

