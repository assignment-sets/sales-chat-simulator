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

import { Toaster } from "sonner";

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://saleschat.io";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: "SalesChat - AI Sales Practice Simulator",
    template: "%s | SalesChat",
  },
  description: "Sharpen your live chat sales skills against hyper-realistic AI prospect personas.",
  openGraph: {
    title: "SalesChat - AI Sales Practice Simulator",
    description: "Sharpen your live chat sales skills against hyper-realistic AI prospect personas with instant coaching feedback.",
    url: appBaseUrl,
    siteName: "SalesChat",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SalesChat - AI Sales Practice Simulator",
    description: "Practice objection handling, negotiation, and closing against realistic prospect personas.",
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
        <Toaster position="top-center" richColors closeButton duration={3500} />
      </body>
    </html>
  );
}
