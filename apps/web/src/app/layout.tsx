import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Planning Platform",
  description: "Convert product requirements into component graphs and roadmaps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
