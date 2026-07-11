# Grovyn Platform - Migration Roadmap & Execution Plan

> **Status:** canonical execution plan. Architecture is frozen as Draft v1
> ([`01`](./01-ARCHITECTURE.md) · [`02`](./02-IMPLEMENTATION-SPEC.md) ·
> [`03`](./03-ARCHITECTURE-READINESS.md)). **This document does not change
> architecture** - it sequences the migration from the current Grovyn One codebase to
> the target platform. **Author role:** Technical Program Manager + Principal Architect.
> **No code, no RFCs, no milestone specs** - execution planning only.

## Operating principles for this migration

1. **Never rewrite a working system.** Every existing subsystem (auth flows, Membership,
   R2 storage, design system, notifications) is *wrapped, extended, or generalized* -
   never replaced from scratch.
2. **Incremental over big-bang.** Each phase ships behind a flag, coexists with the old
   path, and is independently reversible.
3. **Shadow before cutover.** New engines (PDP especially) run in parallel and are
   proven against production traffic before they make decisions.
4. **Expand → migrate → contract.** Schema and behavior changes add first, dual-run,
   then remove - the removal is always the last, evidence-gated step.
5. **A phase is not "done" until its gate is green.** No phase begins before the prior
   phase's success criteria are validated.

**Complexity legend:** S ≤1 day · M 2–3 days · L ~1 week · XL 2+ weeks (one engineer).
Times are engineering effort, not calendar.

---

# The phases

The 10 requested migration areas are sequenced into 11 phases (0–10). Tenant (requested
item #9) is sequenced early - as **Phase 3** - because tenancy underpins authorization
scope and registry install-scope; building those first would force rework.

| Phase | Covers (requested item #) |
| --- | --- |
| 0 · Foundation & guardrails | (enabler for all) |
| 1 · Identity & Principal | #1 |
| 2 · Membership formalization | #2 |
| 3 · Tenant introduction | #9 |
| 4 · Authorization / PDP | #3 |
| 5 · Application Registry | #4 |
| 6 · Navigation & shell | #5 |
| 7 · Engineering app extraction | #6 |
| 8 · Billing app integration | #7 |
| 9 · Future-apps enablement | #8 |
| 10 · Legacy cleanup | #10 |

---

## Phase 0 - Foundation & guardrails

- **Goal.** Stand up the monorepo posture, CI, ambient-tenant/RLS transaction wrapper,
  feature-flag infrastructure, observability baseline, and the app-conformance harness -
  plus the **Prisma multi-schema + RLS spike** that gates all data-shaped work.
- **Why this phase exists.** Every later phase depends on being able to flag, scope,
  observe, and test safely. The RLS/multi-schema decision must be made on evidence
  before any schema is committed to it.
- **Expected outcome.** An empty conformant app boots; flags toggle at runtime; RLS
  proven (or the single-schema fallback chosen) under a pooler; correlation-id tracing
  in place.
- **Prerequisites.** None (starts from `HEAD`).
- **Risks.** Multi-schema tooling friction (Prisma); RLS-under-pooler leakage. Both are
  *the reason this phase exists* - surface them now, not in Phase 4.
- **Rollback strategy.** Entirely non-production; nothing ships to users. Abandoning the
  multi-schema path = adopt the documented single-schema-with-conventions fallback.
- **Breaking changes.** None (no user-facing surface).
- **Testing strategy.** The conformance suite itself is the deliverable; add an
  adversarial tenant-isolation test that *tries* to break out of a tenant under the
  pooler.
- **Success criteria.** Spike report signed off; conformance harness green on a stub;
  flag service live; tracing visible.
- **Downtime:** No · **Feature-flagged:** N/A · **Coexist:** N/A · **Data migration:**
  None · **Gate before next:** RLS/multi-schema decision documented and approved.

## Phase 1 - Identity & Principal (#1)

- **Goal.** Introduce the `Principal` abstraction over `User`, migrate password hashing
  to argon2id transparently, and put token issuance behind an `IdentityIssuer` (IdP
  seam). Lay the (optional) API-key foundation for service accounts.
- **Why this phase exists.** Everything authenticates through a principal; the PDP,
  audit, and agents all need one id type. The IdP seam is what keeps SSO a later
  *addition* rather than a rewrite.
- **Expected outcome.** Auth flows unchanged for users; passwords rehash to argon2id on
  next login; `ServiceAccount`/`AgentIdentity` exist as principal kinds (dormant).
- **Prerequisites.** Phase 0 (flags, CI).
- **Risks.** Password verification regression. Mitigated by a dual-verifier (accept
  bcrypt, rehash to argon2id on success).
- **Rollback strategy.** The IdP seam wraps the existing `JwtService` - reverting is
  swapping the issuer back. Argon2id rows still verify via the dual-verifier.
- **Breaking changes.** None user-visible. Token `role` claim formally demoted to
  advisory (already true in `jwt.strategy`).
- **Testing strategy.** Auth regression suite (login/refresh/switch-org); bcrypt→argon2id
  rehash test; issuer-swap contract test.
- **Success criteria.** 100% of existing auth E2E green; new logins store argon2id;
  principal table backs every existing user.
- **Downtime:** No · **Feature-flagged:** Yes (argon2 rehash, issuer) · **Coexist:** Yes
  (bcrypt + argon2 side by side) · **Data migration:** Backfill `principal` rows from
  `user` (1:1, additive) · **Gate before next:** auth regression green; rehash observed
  in prod.

## Phase 2 - Membership formalization (#2)

- **Goal.** Add the manager edge as `reports_to_membership_id` (distinct from the
  department tree), formalize `Membership` as the sole authority, and prepare - but do
  not execute - the contract-phase removal of legacy `User.orgId`/`role`.
- **Why this phase exists.** Membership is already authoritative; this closes the gaps
  (manager edge, team links) the PDP and org-chart features depend on.
- **Expected outcome.** Manager relationships expressible on membership; legacy fields
  still dual-written by `syncLegacyUserFields` (untouched until Phase 10).
- **Prerequisites.** Phase 1 (principal).
- **Risks.** Manager data currently on `User.managerId` must re-point to membership
  without losing edges. Backfill carefully.
- **Rollback strategy.** Additive columns; drop-forward not required. Revert = ignore
  new columns.
- **Breaking changes.** None (additive).
- **Testing strategy.** Backfill validation (every existing manager edge preserved);
  org-chart read test.
- **Success criteria.** Manager edges resolvable via membership; no reader regressions.
- **Downtime:** No · **Feature-flagged:** Yes (new reads) · **Coexist:** Yes · **Data
  migration:** Backfill `reports_to_membership_id` from `User.managerId` · **Gate before
  next:** backfill parity verified.

## Phase 3 - Tenant introduction (#9)

- **Goal.** Insert `Tenant` above `Organization`; add `Department` (self-referential
  tree) and `Team`; enable ambient tenant context (ALS) and turn on RLS for the first
  tenant-owned tables.
- **Why this phase exists.** Tenancy is the scope authorization and registry
  installations resolve against. It must exist before the PDP (Phase 4) so scopes are
  real, not retrofitted.
- **Expected outcome.** One Tenant per existing Org (backfilled); `orgId` scoping
  unchanged for app data; RLS active as defense-in-depth; Dept/Team available (no
  consumers yet).
- **Prerequisites.** Phase 0 (RLS decision), Phase 2.
- **Risks.** RLS-under-pooler leakage (the top program risk). Ambient-context wrapper
  must be the *only* DB path.
- **Rollback strategy.** Tenant is a parent row; RLS policies can be disabled per table
  via flag if a leak/regression appears. Dept/Team unused → safe to leave dormant.
- **Breaking changes.** None immediately; `tenantId` is additive above `orgId`.
- **Testing strategy.** Adversarial cross-tenant isolation suite under the pooler; RLS
  policy tests per table; backfill parity.
- **Success criteria.** Isolation suite passes; every request carries ambient
  tenant/org; RLS blocks a deliberately mis-scoped query.
- **Downtime:** No · **Feature-flagged:** Yes (RLS per-table, ALS) · **Coexist:** Yes
  (manual `orgId` + ambient both work during transition) · **Data migration:** Backfill
  Tenant per Org; add `tenantId` FKs · **Gate before next:** isolation suite green in
  staging + prod shadow.

## Phase 4 - Authorization / PDP (#3)

- **Goal.** Build the permission catalog, roles-as-bundles, grants, and the PDP
  (`check(principal, action, resource, ctx)`) with the effective-set cache. Run in
  **shadow mode** beside `RolesGuard`, then cut over per-controller behind a flag.
- **Why this phase exists.** The permission engine is one of only two greenfield kernel
  builds; every app's access control depends on it.
- **Expected outcome.** PDP decisions match legacy enum checks on real traffic; `@Roles`
  sites migrate to declared permissions incrementally; `/me/permissions` live.
- **Prerequisites.** Phase 1 (principal), Phase 3 (tenant/scope).
- **Risks.** Correctness regressions (widening or narrowing access); cache staleness
  weakening today's *live* freshness guarantee.
- **Rollback strategy.** Shadow mode has zero enforcement impact. Per-controller flag
  flips back to `RolesGuard` instantly if the PDP disagrees in prod.
- **Breaking changes.** `@Roles` eventually deprecated (staged, per-controller). Frontend
  inline role checks migrate to `usePermissions()` (Phase 6).
- **Testing strategy.** Shadow-diff logging (PDP vs `RolesGuard`) on 100% of authz calls;
  parity threshold before any cutover; cache-invalidation tests on `authz.grants.changed`.
- **Success criteria.** Zero unexplained shadow disagreements over a soak window; seed
  roles (OWNER/ADMIN/MEMBER) reproduce current behavior exactly; cutover on the first
  controller shows no access change.
- **Downtime:** No · **Feature-flagged:** Yes (shadow → per-controller cutover) ·
  **Coexist:** Yes (PDP + RolesGuard run together in shadow) · **Data migration:** Seed
  permission catalog + system roles; backfill grants from current membership roles ·
  **Gate before next:** shadow parity ≥ agreed threshold; first cutover clean.

## Phase 5 - Application Registry (#4)

- **Goal.** Define the manifest contract, the registry loader (catalog sync for
  permissions/events/tools), and the per-tenant `app_installation` lifecycle
  (enable/disable/upgrade/archive/uninstall).
- **Why this phase exists.** The registry is the second greenfield kernel build and the
  keystone - nav, permissions, entitlements, and event routing all derive from it.
- **Expected outcome.** A stub app installs per tenant, surfaces nav, and its declared
  permissions appear in the catalog synced through Phase 4.
- **Prerequisites.** Phase 4 (permission sync), Phase 3 (install scope).
- **Risks.** Manifest shape churn - if it changes after the 2nd app, both rework.
  Stabilize against Engineering (Phase 7) as the reference before Billing.
- **Rollback strategy.** Registry is additive; a stub app can be uninstalled/disabled
  with no effect on existing (un-registered) Engineering routes.
- **Breaking changes.** None yet (Engineering not yet registered).
- **Testing strategy.** Install-lifecycle state-machine tests; catalog-sync idempotency;
  dependency-graph enforcement (refuse enable with unmet deps).
- **Success criteria.** Stub app completes the full lifecycle; permission catalog
  reflects manifest; disabling an app blocks its routes.
- **Downtime:** No · **Feature-flagged:** Yes · **Coexist:** Yes (registry + legacy nav
  both live) · **Data migration:** `application`, `application_version`, `app_installation`
  seed · **Gate before next:** lifecycle + catalog-sync proven on a stub.

## Phase 6 - Navigation & shell generalization (#5)

- **Goal.** Replace the static `nav` array with a registry-driven selector
  (`installed ∩ entitled ∩ permitted`), add the app launcher, wire the command palette to
  the registry, add `usePermissions()`, and extract the design system to `packages/ui`.
- **Why this phase exists.** The shell must become app-agnostic before Engineering
  becomes an app and before Billing can mount.
- **Expected outcome.** Nav renders from manifests; MEMBER-hidden apps disappear
  automatically; palette aggregates app commands; no visual change to existing chrome.
- **Prerequisites.** Phase 5 (registry), Phase 4 (`/me/permissions`).
- **Risks.** Nav/permission filtering hiding something a user should see (regression).
  Snapshot the current nav-per-role before/after.
- **Rollback strategy.** A flag renders the old static `nav` if the registry-driven nav
  misbehaves.
- **Breaking changes.** The static `nav` array is removed (behind the flag first);
  inline `me.role` checks replaced by `usePermissions()`.
- **Testing strategy.** Per-role nav snapshot parity (old vs new); palette command
  visibility by permission; `packages/ui` visual regression.
- **Success criteria.** Nav parity per role; launcher lists exactly the permitted apps;
  no design regression.
- **Downtime:** No · **Feature-flagged:** Yes (nav source) · **Coexist:** Yes ·
  **Data migration:** None · **Gate before next:** nav parity per role verified.

## Phase 7 - Engineering app extraction (#6)

- **Goal.** Register Engineering as the **first application** (manifest, declared
  permissions, own boundary), cut its guards from `RolesGuard` to the PDP, and generalize
  the shared services it exercises - **Events (outbox/inbox/DLQ)**, **Notifications**,
  and **Audit**.
- **Why this phase exists.** Proving the kernel against real, trusted software is the
  entire point of Horizon 1. Engineering is the reference app that hardens the shared
  services and stabilizes the manifest.
- **Expected outcome.** Engineering runs entirely on the platform; emits versioned events
  via the outbox; drives notifications off them; writes a full audit trail - with no
  user-facing change.
- **Prerequisites.** Phases 4–6.
- **Risks.** Guard cutover regressions; event/notification double-delivery during
  transition; scope creep during "extraction."
- **Rollback strategy.** Per-controller PDP flag reverts to `RolesGuard`; the outbox
  runs alongside existing direct notification calls until parity, then the old path is
  removed.
- **Breaking changes.** Internal only (import paths, guard swap, notification source).
- **Testing strategy.** Full Engineering E2E on the platform path; event idempotency
  (inbox dedupe); notification parity (old vs event-driven) before switching.
- **Success criteria.** Engineering fully PDP-governed; events + audit complete;
  notifications event-driven with no user-visible change.
- **Downtime:** No · **Feature-flagged:** Yes (per-module) · **Coexist:** Yes (registered
  app + legacy routes during transition) · **Data migration:** Optional table move to an
  `engineering` schema (last, per-context) · **Gate before next:** Engineering green on
  the platform; shared services hardened.

## Phase 8 - Billing app integration from GrovynDashboard (#7)

- **Goal.** Build Billing **greenfield on the platform** (NestJS module + `app_billing`
  schema + manifest + PDP permissions + TanStack routes on the shared UI). Port only the
  *domain logic* (tax engine, numbering, amount-in-words, document models). ETL the
  GrovynDashboard Mongo data into Postgres. Route AI drafting through a **Claude gateway**.
- **Why this phase exists.** The second app is the thesis proof - it must be a
  generator-driven, low-drama act. It also delivers the user's original goal (Billing
  under one codebase, owner/admin-gated).
- **Expected outcome.** Invoices/quotations/proposals/offer-letters/clients/payments live
  as a registered, entitled, permission-gated app; GrovynDashboard decommissioned.
- **Prerequisites.** Phases 5–7 (stable registry/manifest, shared services), AI gateway
  (kernel, H2) for drafting.
- **Risks.** ETL data fidelity (denormalized snapshots, currency, GST); re-implementing
  the 4×-duplicated GST logic incorrectly; scope creep across 5 document types.
- **Rollback strategy.** Billing ships disabled per tenant; enable for a pilot org first.
  GrovynDashboard stays read-only-available until Billing parity is signed off.
- **Breaking changes.** None to Grovyn One; GrovynDashboard is replaced, not modified.
- **Testing strategy.** GST/numbering/amount-in-words unit suites (correctness-critical);
  ETL reconciliation (row counts + financial totals match source); document PDF parity.
- **Success criteria.** A pilot org runs real billing on the platform; financial totals
  reconcile with GrovynDashboard; AI drafts on Claude with no JSON-repair fallbacks.
- **Downtime:** No (new app) · **Feature-flagged:** Yes (per-tenant enable) · **Coexist:**
  Yes (GrovynDashboard read-only during cutover) · **Data migration:** One-off Mongo→
  Postgres ETL with reconciliation · **Gate before next:** pilot reconciliation signed off.

## Phase 9 - Future-apps enablement (#8)

- **Goal.** Extract `packages/sdk` (from the two real apps - Engineering + Billing),
  finalize the CLI generators (`grovyn new app`), and make conformance the merge gate so
  "add an app" is documented and routine.
- **Why this phase exists.** The platform's ROI is the N-th app's near-zero marginal
  cost. This phase turns that from principle into tooling.
- **Expected outcome.** A new app scaffolds conformant (schema, manifest, tests) and a
  CRM/HRMS/etc. can begin without kernel changes.
- **Prerequisites.** Phase 8 (second real app exists - the SDK is extracted from two, not
  imagined).
- **Risks.** Premature/over-abstracted SDK. Mitigated by the "rule of three" - extract
  only what both apps actually share.
- **Rollback strategy.** SDK is additive tooling; apps can still be authored manually.
- **Breaking changes.** None.
- **Testing strategy.** Generate a throwaway app end-to-end; it must pass conformance
  with zero manual edits.
- **Success criteria.** `grovyn new app` produces a green, conformant skeleton; docs
  describe the full add-an-app path.
- **Downtime:** No · **Feature-flagged:** N/A · **Coexist:** Yes · **Data migration:**
  None · **Gate before next:** generator produces a conformant app.

## Phase 10 - Legacy cleanup / contract phase (#10)

- **Goal.** Execute the contract-phase removals now safe: drop legacy `User.orgId`/`role`
  and `syncLegacyUserFields`, delete the static `nav` array and inline `me.role` checks,
  deprecate `@Roles`, and decommission GrovynDashboard.
- **Why this phase exists.** Removal is always last and evidence-gated. Doing it earlier
  risks breaking auth or nav; doing it never leaves permanent tech debt.
- **Expected outcome.** No dual-write shims, no dead nav, no bcrypt, no
  RolesGuard-as-authority; GrovynDashboard retired.
- **Prerequisites.** Every prior phase; grep-clean evidence that no reader depends on the
  legacy fields/paths.
- **Risks.** Removing something still referenced. Mitigated by grep-gated, one-at-a-time
  removals with a soak after each.
- **Rollback strategy.** Each removal is an isolated, revertible PR; keep a tag before
  each drop migration.
- **Breaking changes.** Legacy fields/paths removed - by definition each is proven
  unused first.
- **Testing strategy.** Full regression after each removal; a "no references" static
  check as the pre-condition for each drop.
- **Success criteria.** Codebase carries no legacy shim; all auth/nav/authz on the new
  path; GrovynDashboard archived.
- **Downtime:** No · **Feature-flagged:** N/A · **Coexist:** No (this ends coexistence) ·
  **Data migration:** Drop legacy columns after backfill-parity confirmed · **Gate before
  next:** production-ready - this is the terminal phase.

---

## Production-readiness definition

The platform is **production-ready** when Phases 0–8 are complete (kernel proven, two
apps live), Phase 9 makes the third app routine, and Phase 10 has removed the migration
scaffolding. Phases 0–7 ship with **zero user-facing change**; Phase 8 is the first new
capability users see.

---

# First 100 Engineering Tasks

Atomic, ordered exactly as they should be implemented. Complexity S/M/L/XL; time is
one-engineer effort. "Deps" reference earlier task ids.

## Phase 0 - Foundation & guardrails

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T001 | Monorepo posture decision | Confirm single-repo layout `apps/{api,web}` + `packages/*`; document, don't move yet | - | S | 1d | repo | Written layout approved; no files moved |
| T002 | CI pipeline baseline | Lint + typecheck + test on PR for backend & frontend | T001 | M | 2d | infra | PR blocked on red; green on `HEAD` |
| T003 | Feature-flag service | Runtime flags scoped platform/tenant/org/user | T002 | M | 3d | kernel/flags | Flag toggles behavior without deploy |
| T004 | Observability baseline | Correlation-id propagation + structured logs + tracing hooks | T002 | M | 3d | kernel/observability | A request traceable end-to-end by id |
| T005 | Prisma multi-schema spike | Prove multi-schema + cross-schema refs + migration ergonomics | T001 | L | 1w | prisma | Spike report with go/no-go |
| T006 | RLS-under-pooler spike | Prove per-tx GUC scoping survives PgBouncer transaction pooling | T005 | L | 1w | prisma, infra | Adversarial cross-tenant query blocked |
| T007 | Data-layer decision record | Adopt multi-schema+RLS or single-schema fallback | T005,T006 | S | 1d | prisma | Decision documented & approved |
| T008 | ALS request-context provider | AsyncLocalStorage carrying `{principal,tenantId,orgId}` | T007 | M | 3d | kernel/tenancy | Context readable in any service in a request |
| T009 | Ambient transaction wrapper | Single DB entry point that sets RLS GUC per tx | T008 | L | 1w | kernel/tenancy, prisma | All queries route through wrapper; GUC set per tx |
| T010 | App-conformance harness | Test suite: tenant scoping, manifest validity, permission decls | T009 | L | 1w | testing/conformance | Stub app passes; violation fails CI |

## Phase 1 - Identity & Principal

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T011 | Principal model + kinds | `principal` table with `kind`, per-kind detail tables | T007 | M | 3d | platform, prisma | Principal row exists per user (backfilled) |
| T012 | Backfill principals from users | 1:1 principal rows for existing users | T011 | S | 1d | prisma | Every user has a principal; parity verified |
| T013 | Argon2id dual-verifier | Verify bcrypt+argon2; rehash to argon2id on login | T011 | M | 2d | platform/auth | New logins store argon2id; old bcrypt still verifies |
| T014 | IdentityIssuer seam | Wrap `JwtService` behind an issuer interface | T011 | M | 2d | platform/auth | Token issuance swappable via config |
| T015 | ServiceAccount kind (dormant) | Schema + no-login principal kind | T011 | S | 1d | platform | Service account creatable; cannot interactive-login |
| T016 | API-key foundation | Hashed keys `gv_<env>_<prefix>.<secret>`, scope, last-used | T015 | M | 3d | platform/auth | Key auth works for a service account; hash-at-rest |
| T017 | AgentIdentity kind (dormant) | Schema for agent principal + budget ref | T011 | S | 1d | platform, ai | Agent principal creatable; no runtime yet |
| T018 | Auth regression gate | Full E2E: login/refresh/switch-org/accept-invite | T013,T014 | M | 2d | platform/auth, web | 100% existing auth flows green |

## Phase 2 - Membership formalization

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T019 | Manager edge column | Add `reports_to_membership_id` to membership | T011 | S | 1d | platform, prisma | Column present; nullable |
| T020 | Backfill manager edges | Map `User.managerId` → membership manager edge | T019 | M | 2d | prisma | Every existing edge preserved; parity report |
| T021 | Org-chart read via membership | Reads resolve manager line from membership | T020 | M | 2d | engineering/people | Org chart identical to today |
| T022 | Team model + links | `team` table + membership↔team join | T011 | M | 2d | platform, prisma | Teams creatable; membership joinable (dormant) |
| T023 | Membership status audit | Ensure status transitions covered for offboarding | T019 | S | 1d | platform | Suspend/offboard paths tested |
| T024 | Legacy-field reader inventory | Grep + document every reader of `User.orgId`/`role` | T018 | S | 1d | backend, web | List of readers to migrate (feeds Phase 10) |

## Phase 3 - Tenant introduction

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T025 | Tenant model | `tenant` table (billing/brand/isolation parent) | T007 | M | 2d | platform, prisma | Tenant creatable |
| T026 | Backfill Tenant per Org | One tenant per existing org; add `org.tenantId` | T025 | M | 2d | prisma | Every org has a tenant; parity verified |
| T027 | Department model (tree) | Self-referential `department` + head edge | T025 | M | 2d | platform, prisma | Nested departments creatable (dormant) |
| T028 | Ambient scope = tenant+org | ALS resolves tenant from active org | T008,T026 | M | 2d | kernel/tenancy | Requests carry tenant+org automatically |
| T029 | RLS policies: first tables | Enable RLS on 2–3 high-value tables behind flag | T009,T028 | L | 1w | prisma | Mis-scoped query blocked; flag-reversible |
| T030 | Cross-tenant isolation suite | Adversarial tests attempting tenant break-out | T029 | L | 1w | testing/conformance | Suite green under pooler in staging |
| T031 | Roll RLS to remaining tenant tables | Extend policies table-by-table | T030 | L | 1w | prisma | All tenant tables RLS-guarded; suite green |
| T032 | Manual-scope deprecation lint | Warn on new hand-threaded `orgId` queries | T028 | S | 1d | infra | New manual scoping flagged in CI |

## Phase 4 - Authorization / PDP

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T033 | Permission catalog tables | `permission`, immutable keys `app:resource:action` | T007 | M | 2d | iam, prisma | Permissions insertable/queryable |
| T034 | Role + role_permission tables | Roles as bundles; system/app/custom | T033 | M | 2d | iam, prisma | Roles map to permissions |
| T035 | role_grant + scope model | `principal × role × scope(+expiry)` | T034 | M | 3d | iam, prisma | Grant at org/dept/team/self persists |
| T036 | Seed system roles | OWNER/ADMIN/MEMBER as fixed permission bundles | T034 | M | 2d | iam | Seeds reproduce current role meaning |
| T037 | Backfill grants from memberships | Each membership role → equivalent grant | T035,T036 | M | 2d | prisma | Grant parity with current membership roles |
| T038 | PDP core `check()` | `check(principal,action,resource,ctx)` engine | T035 | L | 1w | iam | Correct allow/deny for role+scope cases |
| T039 | ABAC conditions | `isOwner`, `inDepartmentSubtree`, `isManagerOf`, status | T038 | L | 1w | iam | Condition cases pass; deny wins |
| T040 | Effective-set cache (L2) | Redis cache keyed `(principal,org)`, TTL + invalidation | T038 | M | 3d | iam, kernel/cache | Cache hit path correct; invalidation on grant change |
| T041 | `authz.grants.changed` invalidation | Publish + consume to bust cache live | T040 | M | 2d | iam, events | Grant change reflected within TTL bound |
| T042 | `/me/permissions` endpoint | Effective permissions for active context | T038 | S | 1d | iam, web | Client receives correct permission set |
| T043 | `/authz/check` + bulk + filter | Single/bulk/filter decision APIs | T038 | M | 2d | iam | Bulk + list-filter return permitted subset |
| T044 | Shadow-mode diff logger | Run PDP beside `RolesGuard`, log disagreements | T038 | M | 3d | iam, common/guards | 100% authz calls shadow-compared |
| T045 | Shadow soak + parity report | Soak in prod; measure disagreement rate | T044 | M | ongoing | iam | Parity ≥ threshold; anomalies explained |
| T046 | `PolicyGuard` + `@RequirePermission` | PDP-backed guard/decorator | T038 | M | 2d | common/guards | Guard enforces PDP when flagged on |
| T047 | Per-controller cutover (pilot) | Migrate one controller `@Roles`→`@RequirePermission` | T045,T046 | M | 2d | one module | No access change vs shadow prediction |

## Phase 5 - Application Registry

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T048 | Manifest contract + types | `PlatformApp` + manifest schema in SDK types | T010 | M | 3d | packages/sdk | Manifest type validates a stub |
| T049 | Application tables | `application`, `application_version` | T033 | M | 2d | platform, prisma | App records persist |
| T050 | Registry loader + reconcile | Collect manifests at boot; idempotent upsert | T048,T049 | L | 1w | kernel/registry | Re-run is a no-op; new perms sync |
| T051 | Permission catalog sync | Manifest permissions → catalog | T050,T033 | M | 2d | kernel/registry, iam | Declared permission appears in catalog |
| T052 | app_installation model | Per-tenant install + config + status | T049,T025 | M | 2d | platform, prisma | Installation row per (tenant,app) |
| T053 | Install/enable lifecycle | Create install, seed roles, run hook, grant admin | T052 | L | 1w | kernel/registry | Enable produces working app state |
| T054 | Disable/enable toggle | Guard rejects routes when installation inactive | T053 | M | 2d | kernel/registry | Disabled app's APIs 403; data intact |
| T055 | Upgrade lifecycle | Version bump + upgrade hook + perm re-sync | T053 | M | 3d | kernel/registry | Upgrade runs migration hook; new perms sync |
| T056 | Archive lifecycle | Read-only state | T053 | M | 2d | kernel/registry | Archived app blocks writes, allows reads |
| T057 | Uninstall + retention | Dependency check, export gate, soft-delete, purge job | T053 | L | 1w | kernel/registry, jobs | Uninstall blocked with dependents; purge after window |
| T058 | Dependency graph enforcement | `dependsOn` respected on enable/uninstall | T053 | M | 2d | kernel/registry | Enable fails on unmet dep |
| T059 | Registry lifecycle test suite | State-machine + idempotency + dep tests | T053..T058 | M | 3d | testing/conformance | Full lifecycle proven on a stub |

## Phase 6 - Navigation & shell

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T060 | Client app-manifest shape | Nav/permissions/entitlement for the frontend | T048 | M | 2d | packages/sdk, web | Client reads a manifest |
| T061 | `usePermissions()` hook | Backed by `/me/permissions` | T042 | S | 1d | web | Returns effective permissions |
| T062 | Registry-driven nav selector | `installed ∩ entitled ∩ permitted` filter | T060,T061 | M | 3d | web/shell | Nav renders from manifests behind flag |
| T063 | Per-role nav parity check | Snapshot old vs new nav per role | T062 | M | 2d | web | Parity verified per role |
| T064 | App launcher surface | Grid of permitted apps | T062 | M | 3d | web/shell | Launcher lists exactly permitted apps |
| T065 | Command palette → registry | Aggregate app commands by permission | T060 | M | 2d | web | Commands appear per permission |
| T066 | Extract `packages/ui` | Move ui/primitives/tokens; apps import shared | T001 | L | 1w | packages/ui, web | No visual regression; shared imports |
| T067 | Retire static `nav` (flagged) | New nav default; old behind kill-switch | T063 | S | 1d | web/shell | Old nav reachable only via flag |

## Phase 7 - Engineering app extraction

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T068 | Event envelope + contracts | `{id,type,version,tenantId,orgId,actor,correlationId,payload}` | T004 | M | 2d | packages/contracts | Envelope frozen; schema published |
| T069 | Outbox table + writer | Event written in same tx as state change | T009,T068 | L | 1w | kernel/events, prisma | No dual-write; event persisted atomically |
| T070 | Dispatcher + in-proc bus | Relay outbox → subscribers | T069 | M | 3d | kernel/events | Event delivered to a consumer |
| T071 | Inbox + idempotency | Consumer dedupe on event id | T070 | M | 2d | kernel/events | Redelivery is a no-op |
| T072 | Retry + DLQ | Backoff + dead-letter + replay tool | T070 | M | 3d | kernel/events | Poison msg → DLQ; replayable |
| T073 | Audit service + table | Append-only, partitioned `audit_entry` | T070 | M | 3d | kernel/audit, prisma | Mutations + PDP decisions logged |
| T074 | Notifications channel seam | Abstract channels; keep FCM+in-app | T070 | M | 3d | platform/notifications | Existing notifications unchanged behind seam |
| T075 | Notification types via registry | Types declared by app manifest | T074,T050 | M | 2d | kernel/notifications | Engineering types registry-driven |
| T076 | Engineering manifest | Declare routes/permissions/events/nav | T048 | M | 3d | engineering | Manifest validates; installs |
| T077 | Engineering permission decls | Map `@Roles` sites → `engineering:*` permissions | T076,T036 | L | 1w | engineering, iam | Every endpoint has a declared permission |
| T078 | Engineering guard cutover | `@Roles`→`@RequirePermission` per module, flagged | T047,T077 | L | 1w | engineering | No access change; shadow-clean |
| T079 | Engineering emits events | Publish domain/integration events via outbox | T069,T076 | M | 3d | engineering | Key actions emit versioned events |
| T080 | Notifications event-driven | Drive Engineering notifications off events | T079,T074 | M | 3d | engineering, notifications | Parity with old direct-send, then switch |
| T081 | Engineering E2E on platform | Full flow on registry+PDP+events path | T078,T080 | L | 1w | engineering, web | All Engineering E2E green |

## Phase 8 - Billing app integration

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T082 | AI gateway (Claude) | Model gateway w/ metering, guardrails, cache | T017 | L | 1w | kernel/ai | Claude call metered per tenant |
| T083 | Billing schema design | `app_billing`: invoice/item/quotation/offer/proposal/client/payment | T007 | L | 1w | app_billing, prisma | Schema review approved |
| T084 | Billing manifest | Routes/permissions/roles/events/entitlement/AI tools | T048 | M | 3d | billing | Manifest validates; installs |
| T085 | Tax engine (shared) | One GST engine (intra/inter/export/non-India) | T083 | L | 1w | billing | Unit suite covers all GST cases |
| T086 | Numbering service | Atomic per-(org,type,year) counter | T083 | M | 3d | billing | Concurrency-safe; no dup numbers |
| T087 | Amount-in-words service | Indian numbering, currency-aware | T083 | S | 1d | billing | Matches known outputs |
| T088 | Client + snapshot logic | Client CRUD + invoice-time snapshot | T083 | M | 3d | billing | Snapshot immutable after send |
| T089 | Invoice + payment lifecycle | Draft→sent(lock)→paid/partial; status recompute | T085,T086,T088 | L | 1w | billing | Payment drives status; locked after send |
| T090 | Quotation + conversion | Quote→invoice conversion path | T089 | M | 3d | billing | Convert produces linked invoice |
| T091 | Offer letters + proposals | HR/sales document types + rich text (TipTap) | T083 | L | 1w | billing | Both document types create/preview |
| T092 | Billing PDF → R2 | Server-render PDF, store in R2 documents | T089 | M | 3d | billing, storage | Stable shareable PDF URL |
| T093 | AI drafting on Claude | Port drafting to gateway; drop JSON-repair | T082,T089 | M | 3d | billing, ai | Draft returns valid structured output |
| T094 | Billing frontend routes | `/billing/*` on shared UI, owner/admin-gated | T066,T084 | L | 1w | web/apps/billing | Screens on platform design system |
| T095 | Mongo→Postgres ETL | Migrate GrovynDashboard data with reconciliation | T083 | L | 1w | billing, infra | Row counts + financial totals reconcile |
| T096 | Billing pilot enablement | Enable for one org; verify end-to-end | T094,T095 | M | 3d | billing | Pilot org bills on platform; totals match |

## Phase 9 - Future-apps enablement

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T097 | Extract `packages/sdk` | Extract shared app-authoring API from 2 real apps | T081,T096 | L | 1w | packages/sdk | Both apps consume the SDK |
| T098 | `grovyn new app` generator | Scaffold conformant schema+manifest+tests | T097 | L | 1w | tools/generators | Generated app passes conformance unedited |

## Phase 10 - Legacy cleanup / contract phase

| # | Title | Objective | Deps | Cx | Time | Modules | Acceptance |
|---|---|---|---|---|---|---|---|
| T099 | Remove legacy shims | Drop `User.orgId`/`role` + `syncLegacyUserFields`; kill static nav + inline role checks | T024,T067,T078 | L | 1w | backend, web, prisma | Grep-clean; full regression green |
| T100 | Decommission GrovynDashboard | Archive repo; retire Express/Mongo/HF stack | T096 | M | 2d | GrovynDashboard | Billing parity signed off; source archived |

---

## Critical-path summary

```
T005/T006 (data spike) → T007 → T008/T009 (ambient+RLS) → T025/T026 (tenant)
   → T033..T038 (PDP core) → T044/T045 (shadow) → T050 (registry) → T053 (install)
   → T062 (registry nav) → T076..T081 (Engineering as app) → T083..T096 (Billing)
   → T097/T098 (SDK+generator) → T099/T100 (contract phase)
```

Everything else parallelizes around this spine. The two hard gates that must not be
rushed: **T007** (data-layer decision) and **T045** (PDP shadow parity) - a wrong call
at either is the only thing on this plan that could force a later rewrite.

## Milestone → phase mapping (to the spec's Horizon 1)

| Spec milestone (§11 of `02`) | Phases | Tasks |
| --- | --- | --- |
| M0 Foundation | Phase 0 | T001–T010 |
| M1 Identity | Phase 1 | T011–T018 |
| M2 Tenancy & hierarchy | Phases 2–3 | T019–T032 |
| M3 Authorization | Phase 4 | T033–T047 |
| M4 Registry | Phase 5 | T048–T059 |
| M5 Engineering as app | Phases 6–7 | T060–T081 |
| M6 Shared services | (within Phase 7) | T068–T075 |
| Horizon 2 onward | Phases 8–10 | T082–T100 |
