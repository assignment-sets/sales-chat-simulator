import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Suspense } from "react";
import { Toaster } from "sonner";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: "Chat2Sell - AI Sales Practice Simulator",
    template: "%s | Chat2Sell",
  },
  description: "Sharpen your live chat sales skills against hyper-realistic AI prospect personas.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Chat2Sell - AI Sales Practice Simulator",
    description: "Sharpen your live chat sales skills against hyper-realistic AI prospect personas with instant coaching feedback.",
    url: appBaseUrl,
    siteName: "Chat2Sell",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/brand/chat2sell-og.png",
        width: 1200,
        height: 630,
        alt: "Chat2Sell - AI Sales Practice Simulator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chat2Sell - AI Sales Practice Simulator",
    description: "Practice objection handling, negotiation, and closing against realistic prospect personas.",
    images: ["/brand/chat2sell-og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="h-full overflow-hidden flex flex-col">
        {children}
        <Suspense fallback={null}>
          <AuthToastWatcher />
        </Suspense>
        <Toaster
          position="top-right"
          expand={true}
          visibleToasts={5}
          richColors
          closeButton
          duration={3500}
          offset={{ top: "20px", right: "20px" }}
        />
      </body>
    </html>
  );
}
