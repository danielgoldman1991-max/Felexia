import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/interface.css";
import "@/styles/print.css";
import { ROOT_METADATA, getSiteStructuredData, serializeJsonLd } from "@/lib/seo";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PublicSupportAssistant } from "@/components/support/PublicSupportAssistant";
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = ROOT_METADATA;
const siteStructuredData = serializeJsonLd(getSiteStructuredData());

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script id="felexia-site-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteStructuredData }} />
        <ThemeProvider>{children}<PublicSupportAssistant /><Suspense fallback={null}><PublicAnalytics /></Suspense></ThemeProvider>
      </body>
    </html>
  );
}
