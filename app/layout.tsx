import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tutor Flow",
    template: "%s | Tutor Flow",
  },
  description: "수업, 숙제, 시험범위, 일정 관리를 위한 튜터링 대시보드",
  applicationName: "Tutor Flow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Tutor Flow",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
