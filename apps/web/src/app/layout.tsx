import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 계획 플랫폼",
  description: "제품 요구사항을 컴포넌트 그래프와 로드맵으로 변환합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
