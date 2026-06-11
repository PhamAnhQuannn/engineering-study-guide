import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mock Interview — Senior Backend Interview Prep",
  description: "Run a timed mock interview across multiple topics and question types.",
};

export default function MockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
