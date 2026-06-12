import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { SidebarContent } from "@/components/SidebarContent";
import { TopicSidebarMobile } from "@/components/TopicSidebarMobile";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Senior Backend Interview Prep",
    template: "%s",
  },
  description: "Practice senior backend software engineering interviews across every topic.",
  openGraph: {
    type: "website",
    siteName: "Senior Backend Interview Prep",
    title: "Senior Backend Interview Prep",
    description: "Practice senior backend software engineering interviews across every topic.",
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <nav className="mx-auto max-w-7xl px-4 py-3.5 flex items-center gap-4 text-sm">
            <Link href="/knowledge" className="font-mono font-semibold tracking-tight shrink-0">
              <span className="text-accent">⌁</span> interviewprep
            </Link>
            <div className="ml-auto">
              <NavTabs />
            </div>
          </nav>
        </header>
        <div className="mx-auto w-full max-w-7xl flex flex-1">
          <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
            <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-4 px-3">
              <SidebarContent />
            </div>
          </aside>
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-6 py-8">{children}</main>
        </div>
        <TopicSidebarMobile />
      </body>
    </html>
  );
}
