import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todo — SDLC Plugin Example",
  description: "로컬 저장 기반 Todo 앱 · sdlc Claude Code 플러그인 방법론으로 구축한 레퍼런스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
