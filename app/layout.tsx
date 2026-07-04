import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trigger Mail AI",
  description: "Build intelligent email workflows from webhooks, mailhooks, and AI.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
