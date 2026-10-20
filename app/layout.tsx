import type { Metadata, Viewport } from "next";
import "./globals.css";
import ResumeGate from "@/components/ResumeGate";

const title = "Reveal Cards";
const description = "ロボットとのカードゲームに、謎解きと特殊能力で挑むブラウザーゲーム。";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reveal-cards-orpin.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: title,
    title,
    description,
    url: "/",
    images: [{ url: "/robots-three.png", width: 1402, height: 1122, alt: "カードゲーム会場のロボットたち" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/robots-three.png", alt: "カードゲーム会場のロボットたち" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#071b12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body><ResumeGate>{children}</ResumeGate></body>
    </html>
  );
}
