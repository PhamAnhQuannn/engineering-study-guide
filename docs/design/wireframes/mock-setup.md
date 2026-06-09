---
screen: mock-setup
route: /mock
last-updated: 2026-06-08
status: draft
---

# Wireframe: Mock Setup

## Purpose
Choose a mock-interview template (or build a custom config) and start a run. Flow: `docs/design/flows/mock-interview.md` step 1.

## Entry Points
- From: dashboard "Start mock interview" CTA.
- Redirects to: in-page `mock-run` state on Start (client-driven; same route).

## Device Targets
Mobile (≤767) single column; Desktop (≥768) template cards in a row.

## Layout — Desktop

```
┌──────────────────────────────────────────────────────────┐
│  Mock interview                                            │
│  Rehearse a realistic loop. Self-graded, offline.         │
│                                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Quick 5     │ │ Senior      │ │ Custom      │          │
│  │ 5 mixed Qs  │ │ Backend Loop│ │ build your  │          │
│  │ ~15 min     │ │ ~60 min     │ │ own         │          │
│  │ [Select]    │ │ [Select]    │ │ [Select]    │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                           │
│  ── Custom (shown only when Custom selected) ──           │
│  Tiers   [▢ Fundamentals ▢ System Design ▢ …]  (multi)    │
│  Types   [▢ Knowledge ▢ Coding ▢ Design ▢ …]   (multi)    │
│  Count   [ 5 ▾ ]      Time / question [ 5 min ▾ ]         │
│                                                           │
│  ┌──────────────────────────┐                             │
│  │   Start mock →           │                             │
│  └──────────────────────────┘                             │
│  ⚠ inline error area (insufficient bank)                  │
└──────────────────────────────────────────────────────────┘
```

**Composition choice:** template cards in a 3-up row (deliberate — three peer choices benefit from side-by-side compare); custom config is a progressively-revealed editorial form below, not a separate page. Not a generic KPI grid.

## Components
| Component | Source | New? |
|---|---|---|
| TemplateCard (selectable) | feature-local | YES |
| Multi-select chips (tiers/types) | feature-local | YES (small) |
| Select (count, time) | existing pattern | no |
| PrimaryButton (Start) | existing | no |

## States
| State | Trigger | UI |
|---|---|---|
| ready | mount | template cards, no custom panel |
| custom-open | Custom selected | reveal config form |
| validating | Start clicked | button → spinner |
| error-insufficient | api/mock/start 422 / shortfall | inline error, keep choices, suggest loosening filters |
| empty-bank | no questions match at all | error + link to browse |

## Interactions
- Selecting a template highlights it; Custom toggles the config panel.
- Start disabled until a template selected (or valid custom config).
- Enter submits when Start focused.

## Data Needs
| What | When | Source |
|---|---|---|
| tier/type options | mount | static (`lib/taxonomy`, `lib/questionTypes`) |
| question set | Start | POST /api/mock/start |

## Out of Scope
Saved/custom presets persistence (v1 ephemeral).
