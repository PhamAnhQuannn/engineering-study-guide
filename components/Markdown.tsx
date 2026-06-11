"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Callout } from "@/components/Callout";

// Shared markdown renderer for prompts, model answers, and study notes.

function toText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return toText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={slugify(toText(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugify(toText(children))}>{children}</h3>,
          blockquote: ({ children }) => {
            const text = toText(children);
            const match = text.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT)]\s*/i);
            if (match) {
              const type = match[1].toLowerCase() as "note" | "tip" | "warning" | "important";
              const body = text.replace(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT)]\s*/i, "");
              return <Callout type={type}>{body}</Callout>;
            }
            return <blockquote>{children}</blockquote>;
          },
          a: ({ href, children }) => {
            // Cross-topic knowledge links are authored as relative GitHub paths like
            // `../../04-architecture-styles/01-knowledge/README.md`. Map them to the
            // in-app study route `/topic/<slug>/study` (folder name minus its NN- prefix
            // equals the topic slug). Preserve any trailing #anchor.
            const knowledgeLink = href?.match(
              /([^/]+)\/01-knowledge\/README\.md(#[^)]*)?$/
            );
            if (knowledgeLink) {
              const slug = knowledgeLink[1].replace(/^\d+-/, "");
              const anchor = knowledgeLink[2] ?? "";
              return <a href={`/topic/${slug}/study${anchor}`}>{children}</a>;
            }
            // Other doc-internal links (overview READMEs, raw *.md) have no in-app
            // route — render as plain text. Keep real + #anchor links clickable.
            const docLink =
              !href ||
              href.endsWith(".md") ||
              href.startsWith("./") ||
              href.startsWith("../") ||
              href.startsWith("/docs");
            return docLink ? <span>{children}</span> : <a href={href}>{children}</a>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
