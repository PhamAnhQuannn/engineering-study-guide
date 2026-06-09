---
last-updated: 2026-06-08
status: implemented (v1)
---

# Landing + GfG Learning Redesign — design decisions

Pivot: drill-only → **learn + drill hub** (GeeksforGeeks-style), on the dark dev-tool design system.

## Nav pattern (`/nav-pattern-pick`)
- **Landing:** topic-first searchable index (topics ARE the content), tier-grouped lists, mono tier labels + score badges. Slim hero (headline + stat strip + mock CTA) above.
- **Inner pages (article/practice):** persistent left **topic-tree sidebar** (`TopicSidebar`, tier→topic, current highlighted via `usePathname`) + sticky right **TOC** built from the article's H2s. 3-column article grid `[sidebar | article | toc]`, collapses to single column on mobile.

## Search UX (`/search-ux`)
- Client-side instant filter (`TopicIndex`), offline — matches topic name + tier name, shows live count, empty-state message. No server round-trip, no index.

## Article template (8 H2 sections)
Core concept · How to use · When to use · Code example (```python) · Real-world example (why) · Effect / impact · Complexity · Pitfalls. Authored in `01-knowledge/README.md`; rendered by `Markdown` (H2/H3 get slug ids for TOC anchors). Prev/next topic links from `TOPICS` order.

## Typography (`/typography-hierarchy-spec`)
Reading-heavy now: article uses the `.md` prose styles; Geist Sans body, Geist Mono for code/meta/TOC labels, tight display headings. Code blocks = `surface-2` + border.

## A11y (`/a11y-design`)
- Search input has `aria-label`; results are plain links.
- Sidebar `<nav aria-label="Topics">`, current topic `aria-current="page"`.
- TOC = anchor links to `#slug` headings (real ids on H2/H3).
- Focus ring (cyan) from the base layer applies to search, links, sidebar.

## Anti-generic
Topic-index landing (not a KPI grid), mono tier rails, dense list (not uniform cards), one cyan accent — pushes further from generic. Emoji-as-icon (T11) still pending a real icon set; re-run `/anti-generic-design-check` after icons.

## Implemented
`components/TopicIndex.tsx`, `components/TopicSidebar.tsx`, `components/Markdown.tsx` (heading ids), `app/page.tsx` (index landing), `app/topic/[slug]/study/page.tsx` (article view + TOC + prev/next). Content proof: `data-structures` knowledge re-authored to the 8-section template. Retrofit of remaining 59 topics is continuous (issue 013).
