"use client";

import { usePathname } from "next/navigation";
import { TopicSidebar } from "./TopicSidebar";
import { SystemsSidebar } from "./SystemsSidebar";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  if (pathname.startsWith("/systems")) {
    return <SystemsSidebar onNavigate={onNavigate} />;
  }
  return <TopicSidebar onNavigate={onNavigate} />;
}
