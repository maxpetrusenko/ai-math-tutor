import React from "react";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { AppProviders } from "../components/AppProviders";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Nerdy - AI Tutor",
  description: "Realtime lessons, open sessions, and live avatars for guided learning.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${headingFont.variable} ${bodyFont.variable}`} lang="en">
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
