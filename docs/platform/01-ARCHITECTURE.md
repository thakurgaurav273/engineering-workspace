# Grovyn OS - Platform Architecture Proposal

> **Status:** design only - no implementation.
> **Horizon:** 5+ years. **Optimizing for:** scale and evolvability, not speed.
> **Author role:** Staff Software + Product Architect.

A multi-tenant platform where identity, permissions, billing, and data are the
**kernel** - and Engineering, Billing, CRM, HRMS and everything after are just
**applications** running on top of it.

---

## 1. System vision

Grovyn One today is an Engineering application with auth bolted to the front. The
vision inverts that relationship.

**Grovyn OS is a tenant-aware application platform.** It does for internal and
external business software what an operating system does for programs: it owns the
hard, shared, dangerous concerns - *who you are, what you're allowed to do, who you
belong to, what you've paid for, where your files live, how work flows between apps* -
and exposes them as stable services so each application can be small, focused, and
disposable.

The mental model is **kernel + userspace**:

```
┌───────────────────────────────────────────────────────────────┐
│ EXPERIENCE SHELL                                               │
│ app launcher · global nav · command palette · org switcher ·  │
│ design system · notifications inbox                            │
├───────────────────────────────────────────────────────────────┤
│ USERSPACE - APPLICATIONS                                       │
│ Engineering · Billing · CRM · HRMS · Recruitment · Inventory  │
│ Helpdesk · Knowledge · Finance · Assets · …                   │
├───────────────────────────────────────────────────────────────┤
│ KERNEL - PLATFORM SERVICES                                     │
│ Identity & Access · Tenancy & Org · Authorization (PDP) ·     │
│ Entitlements & Billing · Application Registry · Events &       │
│ Integration · Notifications · Files & Documents · AI Gateway  │
│ & Agents · Audit                                              │
├───────────────────────────────────────────────────────────────┤
│ FOUNDATION                                                     │
│ PostgreSQL (multi-schema) · Object storage (R2/S3) ·          │
│ Cache / queue · Model providers (Claude)                      │
└───────────────────────────────────────────────────────────────┘
```

Success is one property: **the marginal cost of the N-th application trends toward
zero.** Adding an app should mean writing its domain and declaring a manifest - never
re-solving auth, tenancy, permissions, nav, notifications, or files. If that holds,
hundreds of apps is a content problem, not an architecture problem.

---

## 2. Core platform philosophy

1. **Platform is not an application.** The kernel never imports from an app; apps only
   depend on published kernel contracts. This one rule keeps the platform stable while
   the app catalog churns.
2. **Apps are bounded contexts, isolated by construction.** Each app owns its own data
   (its own schema), speaks to other apps only through *events* and *published service
   interfaces*, and never reads another app's tables. Isolation is structural, not
   disciplinary - so any app can later be extracted into its own service without a
   rewrite.
3. **Everything is tenant-scoped by default.** There is no un-scoped query. Tenant
   context is ambient, enforced at the data layer, and defended in depth at the
   database. Cross-tenant leakage is a class of bug the architecture must make hard to
   write.
4. **Deny by default.** Authorization answers a question; it doesn't hide a button.
   Every action passes through a central decision point that returns *allow* only on
   explicit grant.
5. **The registry is the source of truth.** Shell, launcher, navigation, permission
   catalog, entitlement gating, and event routing are all *derived* from app
   manifests. The platform is configuration-driven, not hard-coded.
6. **API-first, UI-second.** Every capability is an API before a screen. This makes
   mobile, public integrations, and AI agents first-class consumers.
7. **Modular monolith now; distributed later, only where proven.** Optimize for the
   ability to *evolve* into services, not for being distributed on day one.
8. **Build the second app before the abstraction.** The platform SDK is extracted from
   two real apps, not imagined before the first. Premature framework is the most
   expensive mistake available here.

---

## 3. Assumptions challenged

> **Challenge · "Build our own auth"**
> Hand-rolling JWT is fine for login; hand-rolling SAML, SCIM, MFA recovery, session
> revocation, and OIDC federation is a multi-year security liability. **Position:**
> keep a thin first-party identity now, but put token issuance and user federation
> behind an *Identity Provider boundary* so you can adopt Ory/Keycloak (self-host) or
> WorkOS/Auth0 (managed) for enterprise SSO without touching a single app. Design the
> seam now; don't build the SSO stack yet.

> **Challenge · "Microservices to scale"**
> Microservices solve an *organizational* scaling problem (many teams deploying
> independently), not a user-count problem. A well-partitioned modular monolith on
> Postgres serves millions of users behind stateless replicas. **Position:** one
> deployable now, with context boundaries clean enough that the hottest context can
> later be peeled off surgically. Distributing prematurely buys network partitions,
> distributed transactions, and eventual-consistency bugs for scale you don't yet need.

> **Challenge · "RBAC is enough"**
> Static roles across a department tree × hundreds of apps produce a combinatorial
> explosion. **Position:** permission-string RBAC *with scope* now, but route every
> check through a Policy Decision Point whose signature is
> `can(principal, action, resource, ctx)`. That signature is also a ReBAC engine's
> signature - so you can graduate to relationship-based access later without editing
> call sites. RBAC is the implementation; the PDP is the architecture.

> **Challenge · "One Organization = one tenant"**
> White-label resellers, holding companies, and enterprise data-residency all break
> the flat model. **Position:** introduce a `Tenant` above `Organization`. Tenant is
> the billing, branding, and isolation boundary; an Organization is a workspace within
> it. Below Organization sit Departments (a tree) and Teams.

> **Challenge · "Shared DB with orgId is unsafe"**
> Pooled multi-tenancy with a tenant column is standard at your scale and stays cheap.
> The mitigation for leakage isn't DB-per-tenant - it's *ambient scoping + Postgres
> Row-Level Security as defense-in-depth + isolation tests*. **Position:** pooled by
> default; reserve dedicated databases for the handful of regulated/enterprise tenants
> who contractually require it.

> **Challenge · "Apps should be runtime plugins from day one"**
> "Plugin" hides three different systems. ~90% of the value (custom fields, workflow
> rules, feature flags, templates) is *configuration*, not third-party code. A true
> sandboxed extension runtime is the single most expensive thing on this list.
> **Position:** first-party compile-time apps now, configuration-level extensibility
> mid-term, sandboxed third-party plugins only once the catalog and SDK have earned it.

---

## 4. Domain-driven design boundaries

The system splits into **Kernel contexts** (the platform's published language,
upstream to everything) and **Application contexts** (downstream conformists that
depend on the kernel but never on each other's internals).

**Kernel contexts:** Identity & Access · Tenancy & Organization · Authorization ·
Entitlements & Billing · Application Registry · Events & Integration · Notifications ·
Files & Documents · AI Platform · Audit & Observability.

**Application contexts:** Engineering (exists → extract) · Billing (first new build) ·
CRM · HRMS · Recruitment · Inventory · Procurement · Assets · Helpdesk · Knowledge ·
Finance · Hospital · School · Marketplace · Custom.

### Context map - how apps relate

The kernel is the *published language*; apps are *conformists*. Apps never share
tables. When two apps must collaborate, they do so through domain events with an
anti-corruption adapter on the consuming side:

| Producer | Event | Consumer | Reaction |
| --- | --- | --- | --- |
| Recruitment | `candidate.hired` | HRMS | Provision employee + onboarding |
| HRMS | `employee.onboarded` | Assets · Access | Assign equipment, create memberships |
| CRM | `deal.won` | Billing | Draft invoice / project from the deal |
| Billing | `invoice.paid` | Finance | Post to ledger; update cashflow |

> **Note · shared reference data.** "Client" (CRM), "Customer" (Billing), and
> "Account" (Finance) are the same real entity seen through different lenses. Resist a
> single god-table. Model a lightweight kernel **Party/Directory** concept (a stable id
> + minimal identity) and let each app keep its own projection. This is the difference
> between a platform and a monolith with extra folders.

---

## 5. Modules

**Kernel modules (always loaded):** identity · tenancy · authorization · entitlements ·
billing · registry · events · webhooks · notifications · storage · documents ·
ai-gateway · agents · audit · search · admin.

**Application modules (registered via manifest):**

| App | Owns | Status |
| --- | --- | --- |
| Engineering | Check-ins, goals, reviews, recognition, people, task updates, workspace, leaderboard | exists → extract |
| Billing | Invoices, quotations, proposals, offer letters, clients, payments, tax, numbering | first new build |
| CRM | Leads, contacts, deals, pipelines, activities | horizon 2–3 |
| HRMS | Employees, org chart, leave, payroll inputs, documents | horizon 3 |
| Recruitment | Jobs, candidates, pipelines, interviews, offers | horizon 3+ |
| Inventory · Procurement · Assets | Stock, POs, vendors, asset lifecycle | horizon 4 |
| Helpdesk · Knowledge | Tickets, SLAs, articles, search | horizon 4 |
| Finance | Ledger, cashflow, reconciliation | horizon 4+ |
| Hospital · School · Marketplace · Custom | Vertical / customer-specific | horizon 5 |

---

## 6. Organization hierarchy

Five levels, each earning its place:

| Level | Is the boundary for… | Cardinality |
| --- | --- | --- |
| **Tenant** | Billing, subscription, branding/white-label, data isolation, SSO domain | 1 customer = 1 tenant |
| **Organization** | A workspace/company; app installs; the "you are here" context | 1 (usually) · many for resellers & holding groups |
| **Department** | Structural org units; permission scoping; a self-referential *tree* | Many, nested |
| **Team** | Cross-cutting working groups (may span departments) | Many, flat/overlapping |
| **Membership** | A user's presence in an org - carries role, department, title, manager | user × org |

> **Challenge · manager line ≠ department tree.** People report to a manager who is
> frequently not their department's head (matrix orgs, dotted lines). Collapsing the
> two into one hierarchy is a modeling error you pay for forever. Model them
> separately: Department is a structural tree; the manager relationship is an edge on
> Membership (`reportsToMembershipId`). HRMS later enriches this with positions and
> effective-dated history - but the kernel keeps the minimal version because
> authorization and approvals depend on it.

Membership - not the user - is the authoritative unit. The current schema already
hints at this (a `Membership` table exists; `User.orgId`/`role` are flagged legacy).
The platform promotes Membership to first-class and retires the legacy fields.

---

## 7. User lifecycle

Separate the **identity lifecycle** (global, one per human) from the **membership
lifecycle** (per organization). A person can be offboarded from one org while
remaining active in another; erasing the human is a different, rarer act.

| Stage | Identity | Membership |
| --- | --- | --- |
| Provision | Self-signup · invite · SSO JIT · SCIM | Assigned org, department, team, role, manager |
| Activate | Verify / accept / MFA enrol | Status → active; app access by role |
| Operate | Profile, credentials, sessions, devices | Role changes, transfers, added to more orgs |
| Suspend | Lock sign-in (security) | Freeze access without deleting history |
| Offboard | Identity retained for audit | Deactivate; reassign owned resources; revoke sessions |
| Erase | GDPR: anonymize identity, keep anonymized audit | All memberships closed first |

Service accounts and AI agents are *also* principals with lifecycles - created, scoped,
rotated, revoked - so the same machinery governs humans, machines, and agents.

---

## 8. Backend architecture

NestJS **modular monolith**. Kernel modules load unconditionally; app modules
self-register through the registry loader. Four layers per module, dependencies
pointing inward only:

1. **Interface** - controllers (REST now, GraphQL optional later), DTOs, validation.
2. **Application** - use-case services orchestrating a single transaction; the only
   place that starts DB transactions and emits events.
3. **Domain** - entities, value objects, domain services, invariants, domain events.
   No framework, no Prisma.
4. **Infrastructure** - Prisma repositories, storage/AI/email adapters, event
   publishers.

**Cross-cutting kernel mechanisms:**

- **Ambient tenant context** - request-scoped context (AsyncLocalStorage) carrying
  `{ principal, tenantId, orgId }`; repositories auto-inject scope, so "forgot to
  filter by org" stops being possible.
- **Policy guard → PDP** - a single guard resolves `can(principal, action, resource,
  ctx)`. Controllers declare the permission they need; they never inline role checks.
- **Transactional outbox** - state change and its events commit in one transaction; a
  dispatcher relays them. No lost events, no dual-write inconsistency.
- **Published contracts** - apps call each other only through interfaces exported from
  `packages/contracts`; compile-time enforced, swappable for a network client on
  extraction.

> **Inherited foundation.** Grovyn One already has the right bones: NestJS with
> guards/decorators (`@Roles`, `@CurrentUser`, `@OrgId`), org-scoped services, a global
> storage service, Prisma. The work is *promotion* - turning conventions into enforced
> platform mechanisms - not a rewrite.

---

## 9. Frontend architecture

One **shell**, many **app modules**, wired by the registry. The shell owns the chrome
that today's `AppShell` already provides - sidebar, header, org switcher, command
palette, theme, notifications - and becomes app-agnostic.

- **Route namespacing.** Each app owns a URL prefix (`/engineering/*`, `/billing/*`).
  TanStack file-based routing stays; apps live in `src/apps/<key>/routes`, lazy-loaded.
- **Client manifest.** Each app declares nav items, required permissions, required
  entitlements. The shell renders nav + launcher by filtering *installed ∧ entitled ∧
  permitted*.
- **Shared design system.** Tokens, primitives, and shadcn components move to
  `packages/ui` - the single "base standard" every app consumes. An app cannot ship its
  own button.
- **Data layer.** The kernel `api` client (token refresh, response envelope) and React
  Query stay; query keys are namespaced per app to prevent cache collisions.

> **Challenge · "micro-frontends / module federation."** Runtime federation buys
> *independent team deploys* at the cost of version-skew hell. You don't have that
> problem yet. **Position:** compile-time app modules with lazy routes now; adopt
> federation only when separate teams need independent cadences - and even then,
> per-app, not wholesale.

---

## 10. Database architecture

Single PostgreSQL cluster, **pooled multi-tenancy**, with two orthogonal isolation
strategies:

1. **Tenant isolation (rows).** Every tenant-owned row carries `tenantId` (and `orgId`
   where relevant); composite indexes lead with it. Ambient scoping enforces it in app
   code; **Postgres Row-Level Security** enforces it again at the database.
2. **Context isolation (schemas).** Each bounded context gets its own Postgres schema
   (`kernel`, `engineering`, `billing`, `crm`…). Apps physically cannot FK into each
   other; they reference kernel ids and collaborate via events. This makes later
   extraction a migration, not a rewrite.

**Scaling path (in order, only as needed):** PgBouncer + stateless replicas → read
replicas → partition hot tables (events, audit, notifications) → dedicated DB for a
regulated/very large tenant → extract a dominating context to its own DB, then service.

> **Risk · Prisma & multi-schema.** Prisma's multi-schema support is workable but
> constrains cross-schema relations and migration ergonomics. Validate with a spike
> before committing. Fallback: single schema with rigorous `tenantId` + naming
> conventions - less physical isolation, same logical boundaries.

---

## 11. Authentication architecture

**Principals are plural:** human users, service accounts, API clients, and AI agents
are all authenticatable identities with credentials and scopes. This unification lets
agents and integrations run through the exact same permission fabric as people.

- **Credentials** - password + social OAuth now; SSO via OIDC/SAML and SCIM for
  enterprise (behind the IdP boundary); API keys for integrations; short-lived signed
  tokens for agents.
- **Sessions & tokens** - short-lived access JWT + rotating refresh with server-side
  session records (revocable). MFA and step-up for sensitive actions.
- **Active-context selection** - the token carries *who* and *which tenant/org is
  active*, never the role set. Roles resolve at the PDP per request so a permission
  change takes effect immediately.
- **IdP boundary** - token issuance sits behind an interface. First-party issuer now;
  drop in Ory/Keycloak/WorkOS later with zero app changes.

> **Challenge · roles in the JWT.** Grovyn One currently ships `role` inside the access
> token. Convenient, but revoking access then waits for token expiry and can't express
> per-app permission. **Position:** keep identity + active context in the token;
> resolve authorization live; cache aggressively.

---

## 12. Authorization architecture

Four layers, one decision point:

| Layer | Answers | Example |
| --- | --- | --- |
| Platform | Super-admin / support / tenant-admin | Grovyn support impersonation |
| Membership | Coarse role within an org | `OWNER` · `ADMIN` · `MEMBER` |
| Application | App-specific roles = permission bundles | Billing Manager, Recruiter |
| Resource / scope | Which records, narrowed by hierarchy/ownership | "invoices in my department" |

**Permissions as strings** - `app:resource:action` (e.g. `billing:invoice:approve`).
Roles are named bundles; tenants can define *custom* roles from the catalog. Grants
attach a principal to a role at a scope (org / department / team / self).

> **Challenge · design the seam to ReBAC now.** The single most future-proofing
> decision: every check is `can(principal, action, resource, ctx)` and nothing else.
> Today RBAC + scope conditions answer it. When "share this document with that team" or
> deep org-tree inheritance arrives, implement those as relationship tuples
> (Zanzibar-style) *behind the same function*. Call sites never learn the difference.

**Performance:** a PDP with per-request memoization and a short-TTL cache of a
principal's effective permissions. Deny by default; every allow logged to audit.

---

## 13. Application registry - the keystone

Everything hard about "unlimited apps" reduces to one artifact: the **App Manifest** -
both a compile-time declaration (how the module wires in) and a runtime record
(per-tenant install state).

Manifest blocks: **Identity** (key, name, category, icon, version, vendor) ·
**Surface** (route prefix, nav, launcher card, settings schema) · **Permissions**
(catalog + default roles) · **Entitlement** (plan/flag gate, usage limits) ·
**Integration** (events emitted & consumed, webhooks, AI tools) · **Lifecycle**
(install/enable/disable/upgrade/uninstall hooks, owned data schema).

From this one declaration the platform *derives*: launcher and nav, permission catalog,
entitlement gating, event routing, marketplace listing, and AI tool set. A per-tenant
`AppInstallation` row records enabled/disabled + configuration. **Adding an app =
writing its domain + declaring its manifest.**

---

## 14. Navigation architecture

The shell renders nothing hard-coded. It runs one pipeline over the registry:

```
visible apps = installed(tenant) ∩ entitled(subscription) ∩ permitted(principal)
```

- **App launcher** - a grid of visible apps; the "home screen" of the OS.
- **Contextual sidebar** - when inside an app, its nav comes from that app's manifest.
- **Command palette** - aggregates actions and destinations across all visible apps.
- **Deep links & breadcrumbs** - every screen addressable; breadcrumbs from route meta.

A MEMBER never sees Billing; a tenant without the HRMS entitlement never sees HRMS;
nobody hard-codes a menu. Owner/admin-only apps fall out of the *permitted* filter
automatically.

---

## 15. Permission system

1. **Catalog.** On boot the platform collects every app's declared permissions. New
   app, new permissions - no migration.
2. **Roles.** System roles (Owner/Admin/Member) + app-default roles + *tenant-defined
   custom roles*, each a subset of the catalog.
3. **Assignment.** `principal × role × scope`. Scope narrows to org, department
   subtree, team, or self.
4. **Resolution.** The PDP computes effective permissions (union of grants minus
   explicit denies), evaluates scope/ownership conditions, answers `can()` - cached.
5. **Delegated administration.** Tenant admins manage their own roles/grants; platform
   admins never touch tenant data by default (break-glass is audited).

---

## 16. Event system

Two tiers, deliberately distinguished:

- **Domain events** - internal to a context; may change shape freely.
- **Integration events** - public, versioned, stable contracts in
  `packages/contracts`. What other apps, webhooks, and agents subscribe to.

**Delivery:** transactional outbox → dispatcher → in-process bus *now*, swappable for
NATS/Kafka/SQS *at scale* without touching producers or consumers. At-least-once with
idempotency keys; dead-letter queue; consumers idempotent by contract.

**Consumers:** other apps (choreography), the notification engine, the audit log, AI
agents, and the outbound webhook service. This one backbone powers §17, §18, and the
future plugin system's subscriptions.

---

## 17. Notification architecture

A single platform capability, not a feature each app re-implements. Grovyn One already
has in-app + FCM push + preferences - this generalizes them.

- **Types via manifest** - apps register notification types; the preference center is
  generated, not coded.
- **Channels** - in-app inbox, push (FCM), email, SMS, webhook, chat (Slack/Teams)
  behind a provider abstraction.
- **Preferences** - per user × type × channel (extends existing
  `NotificationPreference`), with quiet hours and digests.
- **Event-driven** - notifications are just event consumers: subscribe → template →
  localize → rate-limit/batch → deliver → record.

---

## 18. AI architecture

AI is a **platform layer**, not a HuggingFace call sprinkled inside an app (which is
what GrovynDashboard does today). Five components, all tenant-aware and governed:

- **Model gateway** - unified access to Claude (and others): routing, per-tenant cost
  metering + budgets, PII redaction, caching, fallback.
- **Agent runtime** - agents are *principals with scoped permissions*; an agent can
  only do what its grants allow, through the same PDP as a human.
- **Tool registry** - apps expose tools via manifest (Billing → `draft_invoice`);
  agents discover and call them; every call permission-checked and audited.
- **Knowledge / RAG** - per-tenant knowledge with `pgvector`; retrieval strictly
  tenant-isolated.
- **Governance** - budgets, full audit of AI-initiated actions, human-in-the-loop for
  sensitive operations, prompt/version management.

Ground move: replace the current Mistral-via-HuggingFace document drafting with Claude
behind the gateway - better structured output deletes most of the brittle JSON-repair
code, and every draft becomes a governed, audited action.

---

## 19. Storage architecture

Grovyn One's R2/S3 `StorageService` with presigned direct uploads is already the right
primitive. The platform formalizes it:

- **Tenant-namespaced keys** - `tenant/<id>/app/<key>/…`, UUID object names, never
  trusting client filenames (already the case).
- **Document/artifact store** - generated PDFs and exports get a metadata table +
  versioning + retention; private objects served through short-lived signed URLs bound
  to a permission check.
- **Direct uploads** - presign → client PUT → persist URL (the existing pattern),
  extended with a non-image validation path for PDFs/documents.
- **Later, as triggered** - CDN for public assets, virus scanning, per-tenant
  encryption keys and data residency for regulated tenants.

---

## 20. Future plugin system

"Plugin" is three systems wearing one word. Build them in order:

| Tier | What | Cost | When |
| --- | --- | --- | --- |
| 1 · First-party modules | Compile-time apps via the registry (this proposal) | Low | now |
| 2 · Configuration | Custom fields, workflow rules, templates, feature flags, custom roles - no code | Medium | horizon 4 |
| 3 · Sandboxed extensions | Public SDK, event/webhook subscriptions, UI slots, isolated server functions, OAuth-scoped API, marketplace + review | Very high | horizon 5 |

> **Defer · why not runtime plugins now.** Tier 3 means a security sandbox with
> resource limits, a *versioned public API you can never casually break*, tenant-scoped
> OAuth for third-party code, billing/payouts, and a human review pipeline. It's a
> product line, not a feature. Tier 2 satisfies most "can we customize this?" requests
> at a fraction of the cost - build it first.

---

## 21. Recommended folder structure

A monorepo that makes the kernel/app boundary physical. See the implementation spec
(§8) for the full tree; the shape:

```
grovyn-os/
├─ apps/
│  ├─ api/            # NestJS modular monolith
│  │  └─ src/{ kernel/, apps/, bootstrap/ }
│  └─ web/            # TanStack Start shell
│     └─ src/{ shell/, apps/<key>/, router.tsx }
├─ packages/{ ui/, contracts/, sdk/, config/ }
├─ tools/{ cli/, generators/ }
├─ testing/{ conformance/, e2e/ }
├─ infra/
└─ prisma/{ kernel/, apps/ }
```

> **Defer · the "vertical app package" temptation.** Co-locate by tier now; revisit
> packaging each app as a single backend+frontend package only when an app needs a
> genuinely independent release cycle.

---

## 22. Data model relationships

Conceptual kernel entities and cardinalities. Apps add their own tables in their own
schema, referencing kernel ids (never the reverse, never each other):

| Entity | Key relationships |
| --- | --- |
| Tenant | has many Organization · has one Subscription · has many Application (via Installation) |
| Organization | belongs to Tenant · has many Department, Team, Membership |
| Department | belongs to Organization · self-referential parent (tree) |
| Team | belongs to Organization · many-to-many Membership |
| User (Principal) | has many Membership · has many Credential, Session, Device |
| Membership | joins User × Organization · has Role grants · belongs to Department · reports-to Membership |
| Role | belongs to Tenant (or system) · many-to-many Permission |
| Permission | declared by Application · referenced by Role & Grant |
| RoleGrant | Principal × Role × Scope (org / dept / team / self) |
| Application | declares Permissions, Events, Tools · has many Installation |
| AppInstallation | Tenant × Application · enabled flag · config · entitlement link |
| Subscription / Plan | Tenant → Plan · Plan → Entitlements & feature flags |
| OutboxEvent | emitted by any context · consumed by apps / notifications / webhooks |
| Notification | Principal + type + channel · driven by events |
| FileObject | Tenant-scoped · optional app + entity reference |
| AuditEntry | Principal + action + resource + tenant (immutable) |
| AgentIdentity | a Principal · scoped Permissions · owned by Tenant |

`Membership` already exists (with legacy `User.orgId`/`role` to retire). `Tenant`, the
authorization tables, `Application`/`Installation`, and `Outbox` are the net-new kernel
additions.

---

## 23. Migration strategy

**Strangler + expand/contract.** The live Engineering app never goes down; the platform
grows around it and it becomes the first tenant of its own kernel.

1. **Introduce Tenant above Organization.** Backfill one Tenant per existing Org.
   Reversible.
2. **Promote Membership to authoritative.** Migrate off legacy `User.orgId`/`role`;
   dual-write (expand) until all paths use Membership, then drop them (contract).
3. **Stand up Authorization tables** (Permission/Role/Grant + PDP) in *shadow mode* -
   compute alongside current enum checks, log disagreements - before cutting guards
   over behind a flag.
4. **Add the Application registry.** Register Engineering as the first app; wrap its
   modules in the app boundary. No data moves - a logical boundary first.
5. **Build Billing greenfield** on the new foundation. GrovynDashboard's Mongo data is
   a one-off ETL into the new Postgres billing schema.
6. **Namespace schemas.** Move Engineering's tables into an `engineering` schema once
   the boundary is proven - optional, and last.

Every step is backward-compatible, reversible, and flag-gated. No big-bang cutover.

---

## 24. Risks

| Risk | Mitigation |
| --- | --- |
| Over-engineering vs. time-to-value | Ship Engineering-as-app and Billing early; extract abstractions from two real apps |
| Cross-tenant leakage | Ambient scoping + RLS + standing isolation test suite |
| Authorization complexity & latency | Cache effective permissions; keep RBAC simple until ReBAC needed; explainable decisions |
| Auth build-vs-buy debt | The IdP boundary - app code never depends on how tokens are minted |
| Event-driven debugging | Correlation ids, event catalog, observability from day one |
| Prisma multi-schema friction | Spike early; single-schema-with-conventions is the ready fallback |
| Migration on live data | Expand/contract, shadow mode, flags, reversibility |
| Cognitive load | SDK + generators hide machinery; app authors write domains, not plumbing |

---

## 25. What should NOT be built yet

Each is *designed for* but not *built now*. The trigger is the permission to build it.

| Deferred | Build it when… |
| --- | --- |
| Sandboxed third-party plugins | The first-party catalog is proven and real Tier-3 demand + revenue exists |
| Microservices / service mesh | A single context provably dominates load or a team needs independent deploys |
| ReBAC engine | Sharing / delegation / deep inheritance becomes a real requirement (PDP seam ready) |
| Per-tenant databases | A contract or regulator requires physical isolation |
| Marketplace billing & payouts | Third-party vendors exist to pay |
| Full white-label theming engine | A reseller needs more than logo + palette + domain |
| Multi-region / data residency | An enterprise deal is gated on it |
| Low-code workflow builder | Config-level rules (Tier 2) stop being enough |
| GraphQL federation, native mobile | Client needs genuinely outgrow REST + responsive web |

> **Principle.** The architecture's job is to make each of these a *later addition, not
> a rewrite*. Designing the seam is cheap; building past the seam before you need to is
> the expensive mistake.

---

## 26. Development roadmap

Horizons, not calendar dates - each ends at a demonstrable capability.

- **H1 · Platform foundation** - Tenant/Org/Dept/Team/Membership · Authorization PDP +
  permission catalog (shadow mode) · Application registry + installations · ambient
  tenant scoping. **Outcome:** the kernel exists and *Engineering runs as the first app
  on it.*
- **H2 · First new app + core services** - Billing greenfield · generalized
  Notifications · Events/Outbox · Files/Documents · AI gateway on Claude with first
  tools. **Outcome:** two apps, one platform - the thesis is proven.
- **H3 · Enterprise readiness** - SSO (OIDC/SAML) + SCIM · custom roles · feature flags
  · subscription plans & entitlement enforcement · RLS · audit hardening.
  **Outcome:** sellable to enterprise tenants.
- **H4 · Ecosystem** - first-party marketplace/catalog · configuration extensibility ·
  public API + webhooks + SDK · white-label branding · agent runtime. New apps (CRM,
  HRMS, Helpdesk…) land at this cadence. **Outcome:** the catalog grows without platform
  changes.
- **H5 · Scale & openness** - third-party plugin SDK + sandbox · selective service
  extraction · multi-region · per-tenant isolation. **Outcome:** a platform others
  build on.

---

## 27. Decisions needed to start

Four choices set the shape of Horizon 1. Recommendations in **bold**; none block
reading the rest.

1. **Auth: adopt an IdP boundary now, integrate an external IdP later.** Confirm we
   design the seam in H1 and defer Keycloak/WorkOS to H3 - vs. investing in SSO earlier
   if an enterprise deal is already in sight.
2. **Tenancy isolation: pooled + RLS by default**, dedicated DBs reserved for regulated
   tenants. Confirm vs. a stricter default if a near-term customer demands physical
   isolation.
3. **First app after Engineering-as-app: Billing.** It's the app you already have
   requirements for and the best platform validator - vs. leading with CRM if
   pipeline/revenue tooling is the sharper business need.
4. **White-label: design for it (Tenant boundary), build it in H4.** Confirm it's not a
   Horizon-1 requirement.

> **Recommended first move.** Do *not* start with Billing. Start with Horizon 1 - stand
> up Tenant, Membership, the Authorization PDP (shadow mode), and the Application
> Registry, then re-home the existing Engineering app onto them. That single exercise
> proves the entire kernel against software you already trust, and turns "add Billing"
> into the routine act this whole architecture exists to make it.
