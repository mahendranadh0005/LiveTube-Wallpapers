import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LiveTube Wallpapers | Live Wallpaper Engine & MP4 Creator",
  description: "Create premium live wallpapers for desktop and mobile from any YouTube video. Customize aspect ratios, apply neon glow, vignette, blur, and motion zoom effects with seamless crossfade loops.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#06040a] text-[#f3f1f6] antialiased">
        {children}
      </body>
    </html>
  );
}
