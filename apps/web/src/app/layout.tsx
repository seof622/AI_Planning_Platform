import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "플랜노트",
  description: "계획을 그래프와 로드맵으로 정리합니다.",
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
