import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Senior Backend Interview Prep",
  description: "Practice senior backend software engineering interviews across every topic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-6 text-sm">
            <Link href="/" className="font-mono font-semibold tracking-tight">
              <span className="text-accent">⌁</span> interviewprep
            </Link>
            <Link href="/" className="text-muted hover:text-foreground transition-colors">
              Topics
            </Link>
            <Link href="/mock" className="text-muted hover:text-foreground transition-colors">
              Mock
            </Link>
            <Link href="/progress" className="text-muted hover:text-foreground transition-colors">
              Progress
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
