import type { Metadata } from "next";

export const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";

export const SITE_NAME = "Chat2Sell";

export interface PublicMetadataOptions {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
}

/**
 * Constructs standardized, production-grade SEO metadata for public indexable pages.
 * Enforces explicit index/follow robots directives (noindex: false), canonical URL,
 * and matching OpenGraph + Twitter card configurations.
 */
export function constructPublicMetadata({
  title,
  description,
  path,
  ogType = "website",
}: PublicMetadataOptions): Metadata {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: normalizedPath,
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
      title,
      description,
      url: normalizedPath,
      siteName: SITE_NAME,
      locale: "en_US",
      type: ogType,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Constructs hardened metadata for authenticated or internal pages.
 * Explicitly instructs search crawlers not to index or follow links.
 */
export function constructPrivateMetadata(
  title: string,
  description?: string
): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}
