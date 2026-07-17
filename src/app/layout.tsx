import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "CoBuy AI — Video-First AR Shopping Studio & Neural Ledger",
  description: "An intelligent video-first collaborative shopping and shared financial workspace powered directly by Gemini Live Vision. Explore global retail aisles, translate foreign packaging, point and touch across live video for instant out-loud product evaluations, and settle tabs directly out of natural conversation.",
  openGraph: {
    title: "CoBuy AI — Video-First AR Shopping Studio & Neural Ledger",
    description: "An intelligent video-first collaborative shopping and shared financial workspace powered directly by Gemini Live Vision. Explore global retail aisles, translate foreign packaging, point and touch across live video right right right for out-loud evaluations, and settle group tabs instantly.",
    siteName: "CoBuy AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CoBuy AI — Video-First AR Shopping Studio & Neural Ledger",
    description: "An intelligent video-first collaborative shopping and shared financial workspace powered directly by Gemini Live Vision.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
