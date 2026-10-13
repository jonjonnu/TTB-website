import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTB Uniform · ระบบสั่งเครื่องแบบพนักงาน",
  description: "ระบบสั่งเครื่องแบบพนักงาน TTB × Songsmai",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#091a32" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Kanit:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
