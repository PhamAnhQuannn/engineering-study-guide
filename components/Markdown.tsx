"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          a: ({ href, children }) => {
            // Doc-internal links (relative paths / *.md, authored for GitHub browsing)
            // are meaningless in-app — render as plain text. Keep real + #anchor links.
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
