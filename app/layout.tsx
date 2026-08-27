import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfcf8",
};

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
  ?? (productionHost ? `https://${productionHost}` : "http://localhost:3000");
const metadataOrigin = /^https?:\/\//.test(configuredOrigin)
  ? configuredOrigin
  : "http://localhost:3000";
const title = "Daily English Lens | Turn your day into English";
const description = "Turn the photos and moments from your day into English you will actually use.";

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og-dashboard.png", width: 1744, height: 909, alt: "Daily English Lens daily photo-to-English dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-dashboard.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
