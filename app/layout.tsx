import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PaperGrain } from "@/components/brand/PaperGrain";
import { AppShell } from "@/components/layout/AppShell";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cairn: Data Intelligence Platform",
  description: "AI-powered web data collection with receipts for every cell.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-[100dvh] antialiased">
        <PaperGrain />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
