"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  text: string;
  slug: string;
  level: 2 | 3;
}

// Scroll-spy that tracks which heading is in view.
function useActiveHeading(items: TocItem[]) {
  const [active, setActive] = useState<string>(items[0]?.slug ?? "");
  useEffect(() => {
    const headings = items
      .map((i) => document.getElementById(i.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);
  return active;
}

function List({
  items,
  active,
  onClick,
}: {
  items: TocItem[];
  active: string;
  onClick?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1 border-l border-border">
      {items.map((h) => (
        <li key={h.slug}>
          <a
            href={`#${h.slug}`}
            onClick={onClick}
            className={`block -ml-px border-l pl-3 transition-colors ${
              h.level === 3 ? "pl-6 text-xs" : ""
            } ${
              active === h.slug
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-accent hover:border-accent"
            }`}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

// On-this-page navigation.
//   variant="desktop" → sticky scroll-spy list for the right grid column (hidden < lg)
//   variant="mobile"  → collapsible "Jump to section" dropdown placed in the article (hidden ≥ lg)
export function Toc({ items, variant }: { items: TocItem[]; variant: "desktop" | "mobile" }) {
  const active = useActiveHeading(items);
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  if (variant === "mobile") {
    return (
      <div className="lg:hidden my-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 transition-colors flex justify-between items-center"
          aria-expanded={open}
        >
          <span>Jump to section</span>
          <span className="font-mono text-xs">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="mt-2 text-sm">
            <List items={items} active={active} onClick={() => setOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sticky top-16 text-sm">
      <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted mb-2">
        On this page
      </div>
      <List items={items} active={active} />
    </div>
  );
}
