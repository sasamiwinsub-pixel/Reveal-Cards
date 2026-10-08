import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reveal Cards",
  description: "Casino themed web riddle prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
