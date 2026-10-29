import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? "http://localhost:3000"),
  title: { default: "Echo: your saves, in your voice", template: "%s · Echo" },
  description:
    "Echo turns the posts you save on LinkedIn, X, Instagram, TikTok and YouTube into one library, with each takeaway rewritten in your own voice.",
  openGraph: {
    title: "Echo: your saves, in your voice",
    description: "Stop letting your best saves die in a bookmark folder.",
    type: "website",
  },
  appleWebApp: { title: "Echo" },
  other: process.env.NEXT_PUBLIC_APP_STORE_ID ? { "apple-itunes-app": `app-id=${process.env.NEXT_PUBLIC_APP_STORE_ID}` } : {},
};

export const viewport: Viewport = { themeColor: "#F7F6F2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
