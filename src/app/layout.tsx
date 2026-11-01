import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/interface.css";
import "@/styles/print.css";
import { BRAND } from "@/lib/brand";
import { getAppUrl } from "@/lib/app-url";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PublicSupportAssistant } from "@/components/support/PublicSupportAssistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: "Felexia — Votre ERP au Maroc",
  description:
    "ESSENTIEL pour gérer vos ventes, achats, clients, fournisseurs et trésorerie. PRO sur devis pour l’ERP complet au Maroc. Facturation électronique incluse.",
  icons: {
    icon: [
      { url: BRAND.favicon },
      { url: BRAND.icon32, sizes: "32x32", type: "image/png" },
      { url: BRAND.icon48, sizes: "48x48", type: "image/png" },
    ],
    shortcut: BRAND.favicon,
    apple: BRAND.appleTouchIcon,
  },
  openGraph: {
    type: "website",
    locale: "fr_MA",
    title: "Felexia — Votre ERP au Maroc",
    description:
      "ESSENTIEL pour gérer vos ventes, achats, clients, fournisseurs et trésorerie. PRO sur devis pour l’ERP complet au Maroc. Facturation électronique incluse.",
    images: [{ url: BRAND.logoHorizontal, width: 1783, height: 592, alt: BRAND.name }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}<PublicSupportAssistant /></ThemeProvider>
      </body>
    </html>
  );
}
