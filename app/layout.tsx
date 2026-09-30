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
  adjustFontFallback: true,
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Cairn: Data Intelligence Platform",
    template: "%s : Cairn",
  },
  description: "AI-powered web data collection with receipts for every cell.",
  keywords: ["data intelligence", "web scraping", "fact checking", "receipts", "AI data platform"],
  authors: [{ name: "Cairn Team" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Cairn",
    title: "Cairn: Data Intelligence Platform",
    description: "AI-powered web data collection with receipts for every cell.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cairn: Data Intelligence Platform",
    description: "AI-powered web data collection with receipts for every cell.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cairn-theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-[100dvh] antialiased">
        <PaperGrain />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
