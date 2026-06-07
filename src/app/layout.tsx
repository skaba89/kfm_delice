import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Restaurant Booking Pro Guinée - Plateforme de Réservation pour Restaurants",
  description:
    "Solution complète de réservation et gestion pour restaurants en Guinée. Menu digital, réservations en ligne, gestion des commandes, fidélité clients et plus encore.",
  keywords: [
    "restaurant",
    "Guinée",
    "réservation",
    "menu digital",
    "gestion restaurant",
    "Conakry",
    "booking",
  ],
  authors: [{ name: "Restaurant Booking Pro" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
