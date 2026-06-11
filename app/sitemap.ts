import type { MetadataRoute } from "next";
import { TOPICS } from "@/lib/taxonomy";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = [
    { url: "/knowledge", changeFrequency: "weekly" as const, priority: 1.0 },
    { url: "/practice", changeFrequency: "weekly" as const, priority: 0.9 },
    { url: "/learning-paths", changeFrequency: "monthly" as const, priority: 0.9 },
    { url: "/mock", changeFrequency: "monthly" as const, priority: 0.8 },
    { url: "/progress", changeFrequency: "daily" as const, priority: 0.5 },
  ];

  const topics = TOPICS.flatMap((t) => [
    { url: `/topic/${t.slug}/study`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `/topic/${t.slug}/practice`, changeFrequency: "monthly" as const, priority: 0.7 },
  ]);

  return [...base, ...topics];
}
