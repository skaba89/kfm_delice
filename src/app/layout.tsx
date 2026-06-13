import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Providers } from "@/components/Providers";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { MustChangePasswordDialog } from "@/components/auth/MustChangePasswordDialog";

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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ea580c" />
        <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <MustChangePasswordDialog />
            <Toaster position="top-right" richColors closeButton />
            <PwaInstallPrompt />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
