import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";

import { AppHeader } from "@/components/app-header";
import { AppToastViewport } from "@/components/app-toast-viewport";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mico Nutri Heald",
  description:
    "Sistema de gestion nutricional clinico con Next.js y Supabase.",
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
