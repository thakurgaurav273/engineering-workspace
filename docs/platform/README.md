# Grovyn Platform — Architecture & Specification

This folder is the canonical design record for turning Grovyn One from an Engineering
application into **Grovyn OS**: a multi-tenant platform that hosts unlimited internal
and external applications under one authentication, authorization, and data fabric.

| Doc | Audience | Purpose |
| --- | --- | --- |
| [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) | Leadership, staff eng | The 5-year platform architecture — vision, boundaries, decisions, and what *not* to build yet. |
| [`02-IMPLEMENTATION-SPEC.md`](./02-IMPLEMENTATION-SPEC.md) | Every engineer | The build bible — entities, tables, API contracts, PDP, registry, services, rules, and the Horizon 1 milestone plan. |
| [`03-ARCHITECTURE-READINESS.md`](./03-ARCHITECTURE-READINESS.md) | Leadership, staff eng | Readiness review of Draft v1 against the actual repo — 24 subsystems, reuse/refactor/redesign/remove verdicts, dependency graph, and rewrite risks. |
| [`04-MIGRATION-ROADMAP.md`](./04-MIGRATION-ROADMAP.md) | Eng team, TPM | The canonical execution plan — 11 incremental phases (Phase 0–10) with rollback/testing/success gates, plus the ordered First 100 Engineering Tasks. |

**Status:** design only. No implementation begins until the relevant milestone
specification (see §11 of the spec) is written and approved.

**Reading order:** architecture first (the *why* and the shape), then the
implementation spec (the *how*). The spec is a direct companion to the architecture
and assumes it.
