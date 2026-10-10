//creato da create next app

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PantryAI",
  description: "La tua dispensa smart con AI",
  appleWebApp: {
    title: "PantryAI",
    statusBarStyle: "default",
    capable: true,
  },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

import { WebVitalTracker } from "@/components";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className="h-full antialiased font-sans"
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <WebVitalTracker />
        {children}
      </body>
    </html>
  );
}
