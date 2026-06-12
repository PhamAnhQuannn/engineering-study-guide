"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/learning-paths", label: "Paths" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/systems", label: "Systems" },
  { href: "/practice", label: "Practice" },
  { href: "/mock", label: "Mock" },
  { href: "/progress", label: "Progress" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/knowledge")
    return pathname.startsWith("/knowledge") || (pathname.startsWith("/topic") && !pathname.endsWith("/practice"));
  if (href === "/practice")
    return pathname.startsWith("/practice") || pathname.endsWith("/practice");
  if (href === "/systems") return pathname.startsWith("/systems");
  return pathname.startsWith(href);
}

export function NavTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              active
                ? "text-foreground bg-surface-2 font-medium"
                : "text-muted hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
