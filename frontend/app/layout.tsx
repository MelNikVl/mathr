import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "matchr — AI Recruitment Matching",
  description: "Your agent finds the right job. Before you even apply.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white antialiased">
        <nav className="border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="text-slate-900 font-bold text-xl tracking-tight"
            >
              matchr
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </nav>
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
