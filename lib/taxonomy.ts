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
  { tier: 3, name: "System Design", blurb: "Scaling, caching, APIs, architecture, resilience." },
  { tier: 4, name: "Databases", blurb: "SQL depth, schema, transactions, operations." },
  { tier: 5, name: "Distributed Systems", blurb: "Failure, delivery semantics, consensus, observability." },
  { tier: 6, name: "Code Quality & Architecture", blurb: "Principles, patterns, testing, refactoring." },
  { tier: 7, name: "Infra / DevOps / Cloud", blurb: "Git, CI/CD, containers, cloud, Linux, IaC." },
  { tier: 8, name: "Networking", blurb: "HTTP, TCP/UDP, DNS, TLS, web mechanics." },
  { tier: 9, name: "Security", blurb: "Auth, OWASP, crypto, secrets." },
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
  { tier: 1, name: "Data Structures", slug: "data-structures", description: "Arrays, hashmaps, lists, trees, heaps, graphs, tries.", difficulty: "core", supportedTypes: CODING },
  { tier: 1, name: "Algorithms", slug: "algorithms", description: "Sorting, searching, recursion, DP, greedy, graph traversal.", difficulty: "core", supportedTypes: CODING },
  { tier: 1, name: "Complexity Analysis", slug: "complexity", description: "Big-O time/space, amortized, tradeoff reasoning.", difficulty: "intro", supportedTypes: CONCEPT },
  { tier: 1, name: "Concurrency Basics", slug: "concurrency-basics", description: "Threads, locks, race conditions, deadlock, async.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "DEBUG", "SCENARIO", "KNOWLEDGE"] },
  { tier: 1, name: "Memory Model", slug: "memory-model", description: "Stack vs heap, GC, references, leaks.", difficulty: "core", supportedTypes: CONCEPT },

  // T2 Languages & Runtime
  { tier: 2, name: "Language Deep-Dive", slug: "language-deep-dive", description: "Idioms, type system, runtime model, gotchas.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "EXPLAIN", "DEBUG", "QUIZ"] },
  { tier: 2, name: "OOP & Functional", slug: "paradigms", description: "OOP, functional, immutability, generics.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 2, name: "Error Handling", slug: "error-handling", description: "Exceptions, result types, defensive coding.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "DEBUG", "KNOWLEDGE"] },

  // T3 System Design
  { tier: 3, name: "Scaling", slug: "scaling", description: "Horizontal/vertical, load balancing, stateless design.", difficulty: "advanced", supportedTypes: DESIGN },
  { tier: 3, name: "Caching", slug: "caching", description: "Redis, CDN, strategies, invalidation, TTL.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 3, name: "API Design", slug: "api-design", description: "REST, GraphQL, gRPC, versioning, idempotency.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 3, name: "Architecture Styles", slug: "architecture-styles", description: "Monolith, microservices, event sourcing, CQRS.", difficulty: "advanced", supportedTypes: DESIGN },
  { tier: 3, name: "Resilience Patterns", slug: "resilience", description: "Rate limiting, backpressure, circuit breaker, retries.", difficulty: "advanced", supportedTypes: DESIGN },
  { tier: 3, name: "Capacity Estimation", slug: "capacity-estimation", description: "QPS, storage, bandwidth napkin math.", difficulty: "core", supportedTypes: ["ESTIMATION", "DECISION", "EXPLAIN"] },
  { tier: 3, name: "Design Drills", slug: "design-drills", description: "URL shortener, feed, chat, rate limiter, notifications.", difficulty: "advanced", supportedTypes: ["SYSTEM_DESIGN", "DECISION", "ESTIMATION"] },

  // T4 Databases
  { tier: 4, name: "SQL & Query Optimization", slug: "sql-optimization", description: "Joins, window functions, indexes, EXPLAIN plans.", difficulty: "core", supportedTypes: ["CODING", "EXPLAIN", "KNOWLEDGE", "DEBUG"] },
  { tier: 4, name: "Schema Design", slug: "schema-design", description: "Normalization vs denormalization, modeling.", difficulty: "core", supportedTypes: ["SYSTEM_DESIGN", "DECISION", "EXPLAIN"] },
  { tier: 4, name: "Transactions & Isolation", slug: "transactions", description: "ACID, isolation levels, locking, MVCC, deadlock.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "SCENARIO", "DECISION", "KNOWLEDGE"] },
  { tier: 4, name: "SQL vs NoSQL", slug: "sql-vs-nosql", description: "Data model fit, consistency, scaling tradeoffs.", difficulty: "core", supportedTypes: ["DECISION", "EXPLAIN", "SYSTEM_DESIGN"] },
  { tier: 4, name: "DB Operations", slug: "db-operations", description: "Migrations, zero-downtime, pooling, N+1.", difficulty: "advanced", supportedTypes: OPS },

  // T5 Distributed Systems
  { tier: 5, name: "Failure Handling", slug: "failure-handling", description: "Partial failure, partitions, timeouts, backoff.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "SCENARIO", "DECISION", "SYSTEM_DESIGN"] },
  { tier: 5, name: "Consistency & CAP", slug: "consistency-cap", description: "ACID/BASE, CAP, consistency models, eventual consistency.", difficulty: "advanced", supportedTypes: CONCEPT },
  { tier: 5, name: "Delivery Semantics", slug: "delivery-semantics", description: "Idempotency, at-least/exactly-once, dedup.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "DECISION", "SYSTEM_DESIGN", "SCENARIO"] },
  { tier: 5, name: "Messaging & Queues", slug: "messaging-queues", description: "Kafka, RabbitMQ, pub/sub, event-driven, streams.", difficulty: "core", supportedTypes: DESIGN },
  { tier: 5, name: "Consensus & Replication", slug: "consensus-replication", description: "Raft/Paxos concept, leader election, quorum, replication.", difficulty: "advanced", supportedTypes: CONCEPT },
  { tier: 5, name: "Observability", slug: "observability", description: "Logs, metrics, traces, alerting, SLO/SLA/SLI.", difficulty: "core", supportedTypes: OPS },

  // T6 Code Quality & Architecture
  { tier: 6, name: "Design Principles", slug: "design-principles", description: "SOLID, DRY, YAGNI, coupling/cohesion.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 6, name: "Design Patterns", slug: "design-patterns", description: "Creational/structural/behavioral, when NOT to use.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "DEBUG", "KNOWLEDGE"] },
  { tier: 6, name: "Testing Strategy", slug: "testing", description: "Unit/integration/e2e, TDD, mocking, coverage, flaky tests.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "SCENARIO", "KNOWLEDGE"] },
  { tier: 6, name: "Refactoring & Tech Debt", slug: "refactoring", description: "Safe refactor, legacy code, tech debt management.", difficulty: "advanced", supportedTypes: ["SCENARIO", "DECISION", "DEBUG", "EXPLAIN"] },
  { tier: 6, name: "Clean Code", slug: "clean-code", description: "Readability, abstractions, naming, code smells.", difficulty: "intro", supportedTypes: ["DEBUG", "EXPLAIN", "DECISION"] },

  // T7 Infra / DevOps / Cloud
  { tier: 7, name: "Git Deep", slug: "git", description: "Rebase, bisect, conflict resolution, workflows.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "SCENARIO", "EXPLAIN"] },
  { tier: 7, name: "CI/CD & Deploys", slug: "cicd", description: "Pipelines, blue-green, canary, rollback.", difficulty: "core", supportedTypes: OPS },
  { tier: 7, name: "Containers & Orchestration", slug: "containers", description: "Docker, Kubernetes basics, orchestration.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 7, name: "Cloud Core", slug: "cloud", description: "AWS/GCP compute, storage, network, IAM.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "DECISION", "SYSTEM_DESIGN", "EXPLAIN"] },
  { tier: 7, name: "Linux & OS", slug: "linux-os", description: "Shell, processes, signals, filesystem, permissions.", difficulty: "core", supportedTypes: ["KNOWLEDGE", "SCENARIO", "EXPLAIN"] },
  { tier: 7, name: "Infrastructure as Code", slug: "iac", description: "Terraform, config management, immutable infra.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "KNOWLEDGE"] },

  // T8 Networking
  { tier: 8, name: "HTTP & Web Protocols", slug: "http", description: "HTTP/1.1/2/3, methods, status codes, headers.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 8, name: "TCP/UDP & DNS", slug: "tcp-udp-dns", description: "Transport protocols, handshakes, DNS resolution.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 8, name: "TLS & HTTPS", slug: "tls", description: "TLS handshake, certificates, encryption in transit.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 8, name: "WebSockets & Streaming", slug: "websockets", description: "WebSockets, SSE, long polling, real-time tradeoffs.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "SYSTEM_DESIGN"] },
  { tier: 8, name: "Web Mechanics", slug: "web-mechanics", description: "CORS, cookies, sessions, caching headers.", difficulty: "core", supportedTypes: ["EXPLAIN", "DEBUG", "KNOWLEDGE"] },

  // T9 Security
  { tier: 9, name: "AuthN & AuthZ", slug: "auth", description: "OAuth, JWT, sessions, SSO, RBAC.", difficulty: "advanced", supportedTypes: ["EXPLAIN", "DECISION", "SCENARIO", "KNOWLEDGE"] },
  { tier: 9, name: "OWASP Top 10", slug: "owasp", description: "SQLi, XSS, CSRF, common web vulnerabilities.", difficulty: "advanced", supportedTypes: ["DEBUG", "EXPLAIN", "SCENARIO", "KNOWLEDGE"] },
  { tier: 9, name: "Cryptography Basics", slug: "crypto", description: "Hashing vs encryption, at-rest/in-transit, signing.", difficulty: "core", supportedTypes: CONCEPT },
  { tier: 9, name: "Secrets & Least Privilege", slug: "secrets", description: "Secrets management, key rotation, least privilege.", difficulty: "core", supportedTypes: ["EXPLAIN", "DECISION", "SCENARIO"] },

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
