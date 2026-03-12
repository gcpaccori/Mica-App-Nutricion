import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";

import { AppHeader } from "@/components/app-header";
import { AppToastViewport } from "@/components/app-toast-viewport";
import { getPublicAppUrl } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const publicAppUrl = getPublicAppUrl();
const siteTitle = "Mico Nutri Heald";
const siteDescription = "Pacientes, planes e ingestas en una sola vista clinica.";

export const metadata: Metadata = {
  metadataBase: new URL(publicAppUrl),
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  creator: siteTitle,
  publisher: siteTitle,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: siteTitle,
    description: siteDescription,
    siteName: siteTitle,
    locale: "es_PE",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Vista editorial de Mico Nutri Heald",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/twitter-image"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${syne.variable} antialiased`}>
        <div className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,_rgba(157,108,255,0.14),_transparent_20%),radial-gradient(circle_at_85%_18%,_rgba(76,255,138,0.08),_transparent_18%),linear-gradient(180deg,_#f0efeb_0%,_#eceae4_52%,_#f4f2ee_100%)] text-zink-950">
          <div className="app-noise min-h-screen">
            <AppHeader />
            <AppToastViewport />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
