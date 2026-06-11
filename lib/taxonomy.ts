import type { QuestionTypeKey, Difficulty } from "./questionTypes";

export interface TierDef {
  tier: number;
  name: string;
  blurb: string;
}

export interface TopicSeed {
  tier: number;
  name: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  supportedTypes: QuestionTypeKey[];
}

export const TIERS: TierDef[] = [
  { tier: 1, name: "Fundamentals", blurb: "CS core: data structures, algorithms, complexity, concurrency, memory." },
  { tier: 2, name: "Languages & Runtime", blurb: "Language depth, paradigms, error handling." },
  { tier: 3, name: "Code Quality & Architecture", blurb: "Principles, patterns, testing, refactoring." },
  { tier: 4, name: "Networking", blurb: "HTTP, TCP/UDP, DNS, TLS, web mechanics." },
  { tier: 5, name: "Databases", blurb: "SQL depth, schema, transactions, operations." },
  { tier: 6, name: "Security", blurb: "Auth, OWASP, crypto, secrets." },
  { tier: 7, name: "System Design", blurb: "Scaling, caching, APIs, architecture, resilience." },
  { tier: 8, name: "Infra / DevOps / Cloud", blurb: "Git, CI/CD, containers, cloud, Linux, IaC." },
  { tier: 9, name: "Distributed Systems", blurb: "Failure, delivery semantics, consensus, observability." },
  { tier: 10, name: "Senior Behavioral & Leadership", blurb: "Decisions, decomposition, mentorship, communication." },
  { tier: 11, name: "Real Situations", blurb: "Incidents, tradeoff dilemmas, migrations, war stories." },
  { tier: 12, name: "Product & Business", blurb: "Product sense, metrics, domain modeling, cross-functional." },
];

// Reusable type bundles.
const CONCEPT: QuestionTypeKey[] = ["KNOWLEDGE", "EXPLAIN", "QUIZ"];
const CODING: QuestionTypeKey[] = ["CODING", "DEBUG", "KNOWLEDGE"];
const DESIGN: QuestionTypeKey[] = ["SYSTEM_DESIGN", "DECISION", "EXPLAIN", "ESTIMATION"];
const OPS: QuestionTypeKey[] = ["SCENARIO", "DECISION", "EXPLAIN", "KNOWLEDGE"];
const BEHAVIORAL: QuestionTypeKey[] = ["BEHAVIORAL", "SCENARIO", "DECISION"];
const PRODUCT: QuestionTypeKey[] = ["DECISION", "SCENARIO", "EXPLAIN"];

export const TOPICS: TopicSeed[] = [
  // T1 Fundamentals
  { tier: 1, name: "Complexity Analysis", slug: "complexity", description: "Big-O time/space, amortized, tradeoff reasoning.", difficulty: "intro", supportedTypes: CONCEPT },
  { tier: 1, name: "Data Structures", slug: "data-structures", description: "Arrays, hashmaps, lists, trees, heaps, graphs, tries.", difficulty: "core", supportedTypes: CODING },
  { tier: 1, name: "Algorithms", slug: "algorithms", description: "Sorting, searching, recursion, DP, greedy, graph traversal.", difficulty: "core", supportedTypes: CODING },
  { tier: 1, name: "Memory Model", slug: "memory-model", description: "Stack vs heap, GC, references, leaks.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 1, name: "Concurrency Basics", slug: "concurrency-basics", description: "Threads, locks, race conditions, deadlock, async.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "DEBUG", "SCENARIO", "KNOWLEDGE"] },

  // T2 Languages & Runtime
  { tier: 2, name: "Language Deep-Dive", slug: "language-deep-dive", description: "Idioms, type system, runtime model, gotchas.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "EXPLAIN", "DEBUG", "QUIZ"] },
  { tier: 2, name: "OOP & Functional", slug: "paradigms", description: "OOP, functional, immutability, generics.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 2, name: "Error Handling", slug: "error-handling", description: "Exceptions, result types, defensive coding.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "DEBUG", "KNOWLEDGE"] },

  // T3 Code Quality & Architecture
  { tier: 3, name: "Clean Code", slug: "clean-code", description: "Readability, abstractions, naming, code smells.", difficulty: "intro", supportedTypes: ["DEBUG", "EXPLAIN", "DECISION"] },
  { tier: 3, name: "Design Principles", slug: "design-principles", description: "SOLID, DRY, YAGNI, coupling/cohesion.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 3, name: "Design Patterns", slug: "design-patterns", description: "Creational/structural/behavioral, when NOT to use.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "DEBUG", "KNOWLEDGE"] },
  { tier: 3, name: "Testing Strategy", slug: "testing", description: "Unit/integration/e2e, TDD, mocking, coverage, flaky tests.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "SCENARIO", "KNOWLEDGE"] },
  { tier: 3, name: "Refactoring & Tech Debt", slug: "refactoring", description: "Safe refactor, legacy code, tech debt management.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION", "DEBUG", "EXPLAIN"] },

  // T4 Networking
  { tier: 4, name: "TCP/UDP & DNS", slug: "tcp-udp-dns", description: "Transport protocols, handshakes, DNS resolution.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 4, name: "HTTP & Web Protocols", slug: "http", description: "HTTP/1.1/2/3, methods, status codes, headers.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 4, name: "TLS & HTTPS", slug: "tls", description: "TLS handshake, certificates, encryption in transit.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 4, name: "Web Mechanics", slug: "web-mechanics", description: "CORS, cookies, sessions, caching headers.", difficulty: "core", supportedTypes: ["EXPLAIN", "DEBUG", "KNOWLEDGE"] },
  { tier: 4, name: "WebSockets & Streaming", slug: "websockets", description: "WebSockets, SSE, long polling, real-time tradeoffs.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "SYSTEM_DESIGN"] },

  // T5 Databases
  { tier: 5, name: "SQL vs NoSQL", slug: "sql-vs-nosql", description: "Data model fit, consistency, scaling tradeoffs.", difficulty: "core", supportedTypes: ["DECISION", "EXPLAIN", "SYSTEM_DESIGN"] },
  { tier: 5, name: "Schema Design", slug: "schema-design", description: "Normalization vs denormalization, modeling.", difficulty: "core", supportedTypes: ["SYSTEM_DESIGN", "DECISION", "EXPLAIN"] },
  { tier: 5, name: "SQL & Query Optimization", slug: "sql-optimization", description: "Joins, window functions, indexes, EXPLAIN plans.", difficulty: "core", supportedTypes: ["CODING", "EXPLAIN", "KNOWLEDGE", "DEBUG"] },
  { tier: 5, name: "Transactions & Isolation", slug: "transactions", description: "ACID, isolation levels, locking, MVCC, deadlock.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "SCENARIO", "DECISION", "KNOWLEDGE"] },
  { tier: 5, name: "DB Operations", slug: "db-operations", description: "Migrations, zero-downtime, pooling, N+1.", difficulty: "advanced", supportedTypes: OPS },

  // T6 Security
  { tier: 6, name: "Cryptography Basics", slug: "crypto", description: "Hashing vs encryption, at-rest/in-transit, signing.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 6, name: "AuthN & AuthZ", slug: "auth", description: "OAuth, JWT, sessions, SSO, RBAC.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "DECISION", "SCENARIO", "KNOWLEDGE"] },
  { tier: 6, name: "OWASP Top 10", slug: "owasp", description: "SQLi, XSS, CSRF, common web vulnerabilities.", difficulty: "advanced", supportedTypes: ["DEBUG", "EXPLAIN", "SCENARIO", "KNOWLEDGE"] },
  { tier: 6, name: "Secrets & Least Privilege", slug: "secrets", description: "Secrets management, key rotation, least privilege.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "SCENARIO"] },

  // T7 System Design
  { tier: 7, name: "From Idea to System", slug: "idea-to-system", description: "Ideation → product type → system type → requirements → tradeoffs.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 7, name: "Capacity Estimation", slug: "capacity-estimation", description: "QPS, storage, bandwidth napkin math.", difficulty: "core", supportedTypes: ["ESTIMATION", "DECISION", "EXPLAIN"] },
  { tier: 7, name: "Architecture Styles", slug: "architecture-styles", description: "Monolith, microservices, event sourcing, CQRS.", difficulty: "advanced", supportedTypes: DESIGN },
  { tier: 7, name: "API Design", slug: "api-design", description: "REST, GraphQL, gRPC, versioning, idempotency.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 7, name: "Caching", slug: "caching", description: "Redis, CDN, strategies, invalidation, TTL.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 7, name: "Scaling", slug: "scaling", description: "Horizontal/vertical, load balancing, stateless design.", difficulty: "advanced", supportedTypes: DESIGN },
  { tier: 7, name: "Resilience Patterns", slug: "resilience", description: "Rate limiting, backpressure, circuit breaker, retries.", difficulty: "advanced", supportedTypes: DESIGN },
  { tier: 7, name: "Design Drills", slug: "design-drills", description: "URL shortener, feed, chat, rate limiter, notifications.", difficulty: "advanced", supportedTypes: ["SYSTEM_DESIGN", "DECISION", "ESTIMATION"] },

  // T8 Infra / DevOps / Cloud
  { tier: 8, name: "Git Deep", slug: "git", description: "Rebase, bisect, conflict resolution, workflows.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "SCENARIO", "EXPLAIN"] },
  { tier: 8, name: "Linux & OS", slug: "linux-os", description: "Shell, processes, signals, filesystem, permissions.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "SCENARIO", "EXPLAIN"] },
  { tier: 8, name: "CI/CD & Deploys", slug: "cicd", description: "Pipelines, blue-green, canary, rollback.", difficulty: "core", supportedTypes: OPS },
  { tier: 8, name: "Containers & Orchestration", slug: "containers", description: "Docker, Kubernetes basics, orchestration.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 8, name: "Cloud Core", slug: "cloud", description: "AWS/GCP compute, storage, network, IAM.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "DECISION", "SYSTEM_DESIGN", "EXPLAIN"] },
  { tier: 8, name: "Infrastructure as Code", slug: "iac", description: "Terraform, config management, immutable infra.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "KNOWLEDGE"] },

  // T9 Distributed Systems
  { tier: 9, name: "Failure Handling", slug: "failure-handling", description: "Partial failure, partitions, timeouts, backoff.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "SCENARIO", "DECISION", "SYSTEM_DESIGN"] },
  { tier: 9, name: "Consistency & CAP", slug: "consistency-cap", description: "ACID/BASE, CAP, consistency models, eventual consistency.", difficulty: "advanced", supportedTypes: CONCEPT },
  { tier: 9, name: "Delivery Semantics", slug: "delivery-semantics", description: "Idempotency, at-least/exactly-once, dedup.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "DECISION", "SYSTEM_DESIGN", "SCENARIO"] },
  { tier: 9, name: "Messaging & Queues", slug: "messaging-queues", description: "Kafka, RabbitMQ, pub/sub, event-driven, streams.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 9, name: "Consensus & Replication", slug: "consensus-replication", description: "Raft/Paxos concept, leader election, quorum, replication.", difficulty: "advanced", supportedTypes: CONCEPT },
  { tier: 9, name: "Observability", slug: "observability", description: "Logs, metrics, traces, alerting, SLO/SLA/SLI.", difficulty: "core", supportedTypes: OPS },

  // T10 Senior Behavioral & Leadership
  { tier: 10, name: "Decision Making", slug: "decision-making", description: "Tradeoff reasoning, build vs buy, tech selection.", difficulty: "advanced", supportedTypes: ["DECISION", "SCENARIO", "BEHAVIORAL"] },
  { tier: 10, name: "Problem Decomposition", slug: "decomposition", description: "Break epics into shippable slices, scoping, estimation.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION", "EXPLAIN"] },
  { tier: 10, name: "Mentorship", slug: "mentorship", description: "Unblocking juniors, code review culture, growing others.", difficulty: "core", supportedTypes: BEHAVIORAL },
  { tier: 10, name: "Communication", slug: "communication", description: "Design docs, RFCs, stakeholder mgmt, push-back.", difficulty: "core", supportedTypes: BEHAVIORAL },
  { tier: 10, name: "Project Leadership", slug: "project-leadership", description: "Driving ambiguous projects, cross-team coordination.", difficulty: "advanced", supportedTypes: BEHAVIORAL },

  // T11 Real Situations
  { tier: 11, name: "Incident Response", slug: "incident-response", description: "Prod down, debugging unknown systems, on-call.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION", "BEHAVIORAL"] },
  { tier: 11, name: "Ship-Now vs Do-Right", slug: "ship-vs-right", description: "Deadline pressure, quality tradeoffs.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION", "BEHAVIORAL"] },
  { tier: 11, name: "Tech Debt Calls", slug: "tech-debt-calls", description: "When to pay debt, when to defer.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION"] },
  { tier: 11, name: "Migration Scenarios", slug: "migrations", description: "Big rewrites, data migration, zero downtime.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION", "SYSTEM_DESIGN"] },
  { tier: 11, name: "Conflict & Ownership", slug: "conflict-ownership", description: "Disagreements, blameless postmortems, ownership.", difficulty: "core", supportedTypes: BEHAVIORAL },

  // T12 Product & Business
  { tier: 12, name: "Product Thinking", slug: "product-thinking", description: "User value, prioritization by impact, MVP.", difficulty: "core", supportedTypes: PRODUCT },
  { tier: 12, name: "Metrics & Experimentation", slug: "metrics", description: "Read data, A/B testing, success criteria.", difficulty: "core", supportedTypes: PRODUCT },
  { tier: 12, name: "Domain Modeling", slug: "domain-modeling", description: "Translate business to system, edge cases.", difficulty: "advanced", supportedTypes: ["SYSTEM_DESIGN", "DECISION", "EXPLAIN"] },
  { tier: 12, name: "Cross-Functional Work", slug: "cross-functional", description: "Work with PM/design, requirement clarification, scope.", difficulty: "core", supportedTypes: BEHAVIORAL },
];

// Guided learning paths ("spines"): one running system — ShopFast — threaded across
// the curriculum at deepening levels. Topic order is the recommended reading order.
// See docs/SHOPFAST.md.
export interface SpineDef {
  slug: string;
  name: string;
  blurb: string;
  tiers: number[];
  topics: string[]; // topic slugs, in reading order
}

export const SPINES: SpineDef[] = [
  {
    slug: "build-shopfast",
    name: "Build ShopFast",
    blurb: "From CS building blocks to a working app: fundamentals → language → clean code → networking → data layer.",
    tiers: [1, 2, 3, 4, 5],
    topics: [
      "complexity", "data-structures", "algorithms", "memory-model", "concurrency-basics",
      "language-deep-dive", "paradigms", "error-handling",
      "clean-code", "design-principles", "design-patterns", "testing", "refactoring",
      "tcp-udp-dns", "http", "tls", "web-mechanics", "websockets",
      "sql-vs-nosql", "schema-design", "sql-optimization", "transactions", "db-operations",
    ],
  },
  {
    slug: "design-and-secure-shopfast",
    name: "Design & Secure ShopFast",
    blurb: "Architect for scale and lock it down: security → system design → infrastructure.",
    tiers: [6, 7, 8],
    topics: [
      "crypto", "auth", "owasp", "secrets",
      "idea-to-system", "capacity-estimation", "architecture-styles", "api-design", "caching", "scaling", "resilience", "design-drills",
      "git", "linux-os", "cicd", "containers", "cloud", "iac",
    ],
  },
  {
    slug: "scale-and-ship-shopfast",
    name: "Scale & Ship ShopFast",
    blurb: "Distributed correctness, leadership judgment, and product sense.",
    tiers: [9, 10, 11, 12],
    topics: [
      "failure-handling", "consistency-cap", "delivery-semantics", "messaging-queues", "consensus-replication", "observability",
      "decision-making", "decomposition", "mentorship", "communication", "project-leadership",
      "incident-response", "ship-vs-right", "tech-debt-calls", "migrations", "conflict-ownership",
      "product-thinking", "metrics", "domain-modeling", "cross-functional",
    ],
  },
];

// Canonical learning order across the whole curriculum — the SINGLE SOURCE OF TRUTH
// for how topics are ordered in every nav surface (sidebar, study prev/next, the
// /knowledge & /practice indexes, /learning-paths). Derived from SPINES, then any
// topic not in a spine is appended so nothing ever drops out of navigation.
// NOTE: this is intentionally independent of the TOPICS array order and the docs
// folder numbers — reorder the journey here, not by renaming folders.
export const LEARNING_ORDER: string[] = (() => {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const spine of SPINES) {
    for (const slug of spine.topics) {
      if (!seen.has(slug)) { seen.add(slug); order.push(slug); }
    }
  }
  for (const t of TOPICS) {
    if (!seen.has(t.slug)) { seen.add(t.slug); order.push(t.slug); }
  }
  return order;
})();

// Position of a topic in the canonical learning order (missing → Infinity, sorts last).
export function orderIndex(slug: string): number {
  const i = LEARNING_ORDER.indexOf(slug);
  return i === -1 ? Infinity : i;
}
