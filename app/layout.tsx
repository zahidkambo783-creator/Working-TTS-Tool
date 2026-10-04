import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZK Voice Studio",
  description: "Professional Text-to-Speech platform powered by Microsoft Edge TTS",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
