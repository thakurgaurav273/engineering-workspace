# Grovyn Platform - Implementation Specification (The Build Bible)

> **Status:** design only - no code. **Author role:** Lead Engineer.
> **Governing rule:** nothing is implemented until its milestone specification (§11) is
> written and approved. Companion to [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md).

The contract every engineer follows for the next three years - entity by entity, table
by table, endpoint by endpoint.

---

## 1. Platform hierarchy & core entities

Every principal and every scope is one of nine things. Get these boundaries exact and
the rest is bookkeeping.

> **Challenge · "these are nine peer entities."** They are not. Two different trees are
> fused into one list. **Scopes** (Platform → Tenant → Organization → Department →
> Team) form a containment hierarchy. **Principals** (User, Service Account, AI Agent)
> are actors that *authenticate*. **Membership** is the edge that binds a principal to
> a scope. Treating Membership as "just another entity" is how these systems rot - so
> we make it the load-bearing join.

### Principal - the authentication supertype

Before the nine, one unifying concept. **Principal** is anything that can hold
credentials and be authorized: `User`, `ServiceAccount`, `AgentIdentity`. One
`principal` table with a `kind` discriminator + per-kind detail tables. Why: the PDP,
audit log, session store, and grant tables all reference *one* id type. A human, a
webhook integration, and an AI agent are governed by the same permission fabric.

| Entity | Responsibility | Owned by | Lifecycle |
| --- | --- | --- | --- |
| **Platform** | The control plane: global config, published app catalog, plans, staff. A singleton, not a per-tenant row. | Grovyn ops | Exists once; versioned by deploy |
| **Tenant** | The commercial + isolation boundary: subscription, branding/white-label, SSO domain, custom roles, data residency. | Platform | provisioning → active → suspended → churned → purged |
| **Organization** | A workspace inside a tenant; the active "you are here" context; the scope stamped on all app data (`org_id`). | Tenant | created → active → archived |
| **Department** | Structural org unit; self-referential tree; permission-scope node + reporting rollup. Has a head (a Membership). | Organization | created → moved/renamed → archived |
| **Team** | Cross-cutting working group; flat; may span departments; used for assignment, collaboration, scope. | Organization | created → membership churn → archived |
| **Membership** | **The authoritative unit.** Binds a User to an Organization; carries role grants, department, title, manager edge, status. | Organization + User | invited → active → suspended → offboarded |
| **User** | A global human identity. Owns credentials, sessions, devices, profile, preferences. One per human across all tenants. | Self / platform | see §2 & §7 |
| **Service Account** | Non-human principal for integrations; holds API keys; scoped permissions; no interactive login. | Organization | created → rotated → revoked |
| **AI Agent** | Principal with an execution runtime; scoped permissions + spend budget; acts autonomously or on delegated authority. | Organization | created → active → paused → revoked |

> **Decision · global identity, per-org membership.** A `User` is **global** (one
> login, one credential set) and joins organizations through `Membership`. This gives
> one identity for consultants/guests across tenants and a clean SSO story.
> **Trade-off:** a strict-isolation tenant can force SSO for its email domain (identity
> still exists once, authentication delegated to their IdP), and regulated tenants
> needing physically separate identity data get a dedicated database (§7). We do *not*
> duplicate a human into per-tenant user rows - that path leads to reconciliation hell.

### Manager & Lead are relationships, not roles

"Department Head", "Manager", "Lead" describe *edges*, not granted permission bundles.
A manager's authority to approve a report's leave comes from the reporting edge on
`Membership` (`reports_to_membership_id`), evaluated as a policy condition - not from a
static "Manager" role you assign and forget. Department Head is `head_membership_id` on
`department`. This is the seam §3 keeps ReBAC-ready.

---

## 2. Authentication

Authentication answers only "who is this principal, on which device, in which session."
It never answers "what may they do" - that is §3, resolved live.

### Token model

| Token | TTL | Carries | Why |
| --- | --- | --- | --- |
| Access (JWT) | ~10 min | `sub`, `kind`, `active_tenant`, `active_org`, `session_id` - **no roles** | Small blast radius; authz resolved fresh so revocation is instant |
| Refresh (opaque) | ~30 days, rotating | Reference to a server-side session + token family | Rotation + reuse detection catches theft; server record enables kill-switch |
| API key | Long-lived, revocable | Prefix + hashed secret; bound to a service account & scope | Machine-to-machine; hashed at rest so a DB leak isn't a key leak |
| Agent token | Minutes | Agent principal + delegation context + budget ref | Agents are ephemeral, constrained, audited per run |

> **Challenge · current stack uses bcrypt + roles-in-JWT.** Two changes. (1) Password
> hashing moves to `argon2id` (memory-hard, resists GPU cracking). (2) Roles leave the
> JWT - today a role change waits for token expiry and can't express per-app
> permission; live resolution (§3) fixes both. Non-negotiable for a multi-app platform.

### Password sign-in flow (the reference; others are variations)

1. **Identify + rate-limit.** Email → lookup principal. Per-IP and per-account
   throttles; generic errors (no user enumeration).
2. **Verify.** argon2id compare. On tenant-SSO-enforced domains, reject password and
   redirect to the IdP.
3. **Step-up (if required).** MFA (TOTP/WebAuthn) when account, tenant policy, or risk
   signal demands it.
4. **Establish session.** Create `session` bound to a `device`; open a refresh token
   family.
5. **Issue tokens.** Short access JWT (active tenant/org from default membership) +
   rotating refresh.

### Mechanism variations

- **OAuth / social** - Google / Microsoft / GitHub via OIDC. Link to an existing
  identity only on a *verified* matching email; otherwise provision a new User. Never
  trust an unverified email claim.
- **Magic link** - single-use signed token, short TTL, one active link per address;
  consumes on first use.
- **Future SSO (OIDC/SAML)** - per-tenant IdP config, routed by email domain; JIT
  provisioning of User + Membership; SCIM for lifecycle. Behind the IdP boundary -
  *designed now, built in H3.*
- **API keys** - issued to service accounts. Format `gv_<env>_<prefix>.<secret>`; only
  the hash + prefix stored; last-used + scope tracked; instantly revocable.
- **Agent authentication** - the agent runtime mints a short token for a specific run,
  carrying the delegation (acting as whom, within which budget). Every agent action
  re-checks the PDP as that principal.
- **Refresh rotation + reuse detection** - each refresh returns a new one and
  invalidates the old. If a *used* refresh reappears, the whole family is revoked.

### Session & device management

A **session** = a device + a refresh-token family + metadata (ip, user-agent, created,
last-seen). A **device** is a recognized client that can carry a push token (FCM) and
an MFA "remember" flag. Users see and revoke sessions individually or "sign out
everywhere"; admins force-revoke on offboarding. Both are first-class tables (§7), not
JWT claims - because the point of server-side sessions is that we can end them.

### Auth API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Password / begin a session |
| POST | `/auth/oauth/:provider` | Social sign-in callback exchange |
| POST | `/auth/magic-link` | Request / consume a magic link |
| POST | `/auth/refresh` | Rotate tokens (reuse-detecting) |
| POST | `/auth/switch-context` | Change active tenant/org; re-mint access token |
| GET | `/auth/sessions` | List a principal's sessions/devices |
| DELETE | `/auth/sessions/:id` | Revoke one / all |

---

## 3. Authorization & the permission engine

One function governs the entire platform:
`check(principal, action, resource, ctx) → decision`.

### The role tiers, correctly classified

| Tier | What it really is | Scope |
| --- | --- | --- |
| Super Admin | Platform principal; break-glass, fully audited | Platform |
| Platform Admin | Grovyn staff; support & catalog ops | Platform |
| Tenant Owner | System role | Tenant |
| Org Owner / Org Admin | System roles | Organization |
| Department Head | **Relationship** - `department.head_membership_id` | Department subtree |
| Manager / Lead | **Relationship** - `membership.reports_to` | Report set (dynamic) |
| Member | Default system role | Organization |
| Guest | External principal; resource-scoped grants only | Specific resources |
| App roles | Per-app permission bundles (Billing Manager, Recruiter…) | Org / dept / team |

> **Challenge · don't model Manager/Head as assignable roles.** If "Manager" is a role
> you grant, you now have two sources of truth for the reporting line (the grant and
> the org chart) and they *will* drift. Authority that derives from a relationship must
> be *evaluated* from that relationship, not copied into a grant. This is why the PDP
> takes conditions, not just roles.

### Permission strings, policies, scopes

- **Permission** = `app:resource:action` (e.g. `billing:invoice:approve`). Wildcards
  for admin bundles (`billing:*:*`). Declared by apps, synced to a catalog.
- **Role** = a named set of permissions (system, app-default, or tenant-custom).
- **Grant** = `principal × role × scope`, optionally time-boxed.
- **Policy condition** (ABAC) = predicates the PDP evaluates against resource
  attributes: `isOwner`, `inDepartmentSubtree`, `isManagerOf`, `statusIs(draft)`,
  `withinBusinessHours`.
- **Scope** = platform / tenant / org / department(subtree) / team / self / resource.

### Database tables (schema `iam`)

| Table | Key columns | Notes |
| --- | --- | --- |
| permission | `id, app_key, resource, action, key, description` | Synced from manifests; immutable keys |
| role | `id, tenant_id?, app_key?, key, name, is_system` | `tenant_id NULL` = system role |
| role_permission | `role_id, permission_id` | Bundle membership |
| role_grant | `id, principal_id, role_id, scope_type, scope_id, granted_by, expires_at` | The assignment; indexed on `(principal_id, scope_type, scope_id)` |
| policy | `id, role_id?, permission_id?, effect, condition_expr` | Optional ABAC conditions; *deny* wins |
| relation_tuple | `subject, relation, object` | Designed, not built - the ReBAC seam |

### The PDP - evaluation pipeline

1. **Load subject grants** for `(principal, active_org)` from cache (fallback: DB).
2. **Filter by scope** - keep only grants whose scope contains the target resource.
3. **Expand to permissions** and match the requested `action`; short-circuit on any
   explicit *deny*.
4. **Evaluate conditions** - ownership, department subtree, `isManagerOf`, resource
   status. This is where relationships resolve.
5. **Decide + log.** Default deny. Emit an audit decision with the reason.

### Authorization API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/authz/check` | Single `{action, resource}` → `{allow, reason}` |
| POST | `/authz/check-bulk` | Many actions/resources in one round-trip (UI gating) |
| POST | `/authz/filter` | Given a resource type + candidate ids → the permitted subset |
| GET | `/me/permissions` | Effective permission set for the active context |
| POST | `/tenants/:id/roles` | Custom role CRUD (delegated admin) |

### Caching & performance

- **L1 · request memo** - same check twice in a request → computed once.
- **L2 · effective set** - principal's resolved permissions in Redis, keyed
  `(principal, org)`, TTL ~60s, invalidated on `authz.grants.changed`.
- **DB pushdown** - list endpoints get scope predicates pushed into the query - you
  fetch only rows you may see, not fetch-then-filter.

> **Rule · never authorize by hiding UI.** The client calls `/me/permissions` to decide
> what to *show*; the server calls the PDP to decide what to *allow*. Both, always.

> **Challenge · why this survives the jump to ReBAC.** Call sites only ever say
> `check(principal, action, resource, ctx)`. Today RBAC+ABAC answers it. When
> relationship graphs arrive, we populate `relation_tuple` and the PDP consults it -
> same signature, zero call-site edits. RBAC is expressible as tuples (a grant is a
> relation), so migration is additive.

---

## 4. Application registry

The registry is the difference between "we have apps" and "we have a platform."

### How an app registers

An app is a backend module implementing a `PlatformApp` contract exposing a static
**manifest**. At boot, the registry loader collects every manifest and *reconciles* it
into the database - upserting `application`, `application_version`, its permission
catalog, its declared events, and its AI tools. Reconciliation is idempotent (like a
migration): declaring a new permission in the manifest is how it enters the catalog. No
app is ever hand-registered.

### Manifest structure

| Block | Declares |
| --- | --- |
| identity | `key, name, category, icon, vendor` |
| version | `version` (semver), `minPlatform`, `dependsOn[]` |
| surface | route prefix, nav items, launcher card, command-palette commands, settings schema |
| permissions | permission catalog + default roles the app ships |
| entitlement | required plan / feature flag; metered usage counters |
| integration | events emitted & consumed, webhooks, AI tools |
| lifecycle | install / enable / disable / upgrade / uninstall hooks; owned DB schema |

### Installation lifecycle (per tenant · table `app_installation`)

```
available → installed/enabled ⇄ disabled → upgrading → archived → uninstalled
```

| Transition | What happens |
| --- | --- |
| Enable | Create installation, run install hook, seed default roles + tenant defaults, grant installer the app-admin role, surface nav. |
| Disable | Hide nav; guards reject the app's routes/APIs while installation is inactive; data retained untouched. |
| Upgrade | Bump version; run upgrade hook + app migrations; sync new permissions/events; optional feature-flagged gradual rollout. |
| Archive | Read-only mode - data visible, no new writes. A safe parking state before uninstall. |
| Uninstall | Blocked if other installed apps depend on it. Requires export; soft-delete with a retention window, then a purge job. |

### Versioning, dependencies, licensing

- **Versioning:** semver; manifest pins `minPlatform`. Breaking an app's own public
  events/APIs requires a major bump (§6).
- **Dependencies:** `dependsOn: [directory >= 1.2]`. Registry refuses to enable an app
  whose deps aren't satisfied, and to uninstall one with dependents.
- **Feature flags:** declared per app, evaluated by the Feature Flag service (§5),
  scoped per tenant/org/user for staged rollout.
- **Licensing / entitlement:** enablement gated by the tenant's subscription; usage
  counters meter against plan limits.

### What the registry generates

- **Navigation** - nav + launcher from manifests, filtered
  `installed ∩ entitled ∩ permitted`. Today's static `nav` array in `app-shell.tsx` is
  retired.
- **Permissions** - catalog is the union of every enabled app's declared permissions.
- **Command palette** - aggregates each app's declared commands (id, title, action,
  required permission).

---

## 5. Platform services

Eighteen kernel services. Each is a module with a clear responsibility and a stable
interface that apps consume - never re-implement.

| Service | Responsibility | Primary interface |
| --- | --- | --- |
| Identity | Principals, credentials, sessions, devices, MFA, IdP boundary | `/auth/*`, `IdentityService` |
| Authorization | Permission catalog, roles, grants, PDP, effective-set cache | `/authz/*`, `can()` |
| Notifications | Type registry, channels, preferences, templates, digests, delivery | `NotificationService.send()`, event consumer |
| Audit | Immutable, append-only record of who did what to which resource | `AuditService.record()`, `/audit` |
| Storage | Object store abstraction, presigned uploads, artifact/document store | `StorageService` (presign/buildKey/delete) |
| Search | Cross-app indexing + tenant-scoped query; powers palette + global search | `SearchService.index()/query()` |
| AI Gateway | Model routing, cost metering, guardrails, caching, agent runtime, tool registry | `/ai/*`, `AiGateway.invoke()` |
| Events | Outbox, dispatcher, inbox, DLQ, replay (§6) | `EventBus.publish()/subscribe()` |
| Billing | Plans, subscriptions, invoicing of tenants, usage rollup | `/billing/*` (platform-level) |
| Entitlements | Resolves what a tenant may use / how much; gates apps & features | `Entitlements.check(feature, usage)` |
| Configuration | Layered settings: platform → tenant → org → user; typed schemas | `Config.get(key, scope)` |
| Feature Flags | Staged rollout, kill-switches, per-scope targeting | `Flags.enabled(key, ctx)` |
| Secrets | Encrypted tenant/app credentials (integration tokens, SMTP) | `Secrets.get/set` (envelope-encrypted) |
| Background Jobs | Durable async work queue, retries, concurrency limits | `Jobs.enqueue()` |
| Webhooks | Outbound delivery to external subscribers with signing + retries | event consumer, `/webhooks` admin |
| Scheduler | Cron / delayed / recurring triggers → jobs or events | `Scheduler.schedule()` |
| Health Monitoring | Liveness/readiness, dependency probes, per-app health | `/health`, `/ready` |
| Metrics | App + platform telemetry, usage counters, SLOs | OpenTelemetry export |

> **Rule · apps consume services, never providers.** An app calls `AiGateway`, not
> Anthropic's SDK. It calls `StorageService`, not the S3 client. It calls
> `NotificationService`, not SMTP. Every external dependency is behind a kernel service
> so we govern cost, swap providers, and enforce tenancy in one place.

---

## 6. Cross-app communication

Apps collaborate exclusively through versioned events. No app calls another app's
service synchronously on a user's critical path.

### Event envelope (stable contract in `packages/contracts`)

| Field | Meaning |
| --- | --- |
| id | Unique event id (idempotency key) |
| type | `app.resource.event` - e.g. `billing.invoice.paid` |
| version | Schema version of this event type |
| occurredAt | Domain timestamp |
| tenantId / orgId | Scope - every event is tenant-bound |
| actor | The principal that caused it |
| correlationId / causationId | Trace a whole reaction chain end to end |
| payload | Versioned, minimal - ids + essential facts, not whole aggregates |

### Delivery guarantees

1. **Outbox.** The producer writes the event to an `outbox` row *in the same
   transaction* as its state change. No dual-write, no lost events.
2. **Dispatch.** A relay reads the outbox (poll now; logical-replication/CDC later) and
   publishes to the bus (in-process now; broker at scale) - producers never change.
3. **Inbox.** Each consumer records processed `event.id` in an `inbox`; a redelivery is
   a no-op. At-least-once + idempotent = effectively-once.
4. **Retry.** Exponential backoff with jitter, bounded attempts, per-consumer isolation.
5. **Dead-letter.** Exhausted messages land in `dead_letter` with the failure + full
   envelope; alerting + a replay tool for operators.

### Versioning & idempotency

- **Additive within a major:** add optional fields freely; never remove or repurpose.
  Breaking changes mint a new `version`; consumers pin, and *upcasters* translate old →
  new.
- **Idempotency everywhere:** inbox dedupe on the consume side; idempotency keys on
  commands so a retried API call can't double-charge or double-create.
- **Integration vs domain:** only *integration* events (public, versioned) cross app
  boundaries. Internal domain events stay inside their context and may change freely.

> **Challenge · "just call the other app's API."** Synchronous cross-app calls recreate
> the monolith's coupling with the network's failure modes - one app's outage cascades
> into another's request path. Events decouple availability *and* keep the
> extraction-to-services path open (§10). The only exception is a genuine synchronous
> *query* need, which goes through a published read interface with an explicit timeout
> + fallback, never a write.

---

## 7. Data architecture

One PostgreSQL cluster, many schemas, strict ownership. The schema map *is* the module
boundary made physical.

### Schema layout

| Schema | Owns |
| --- | --- |
| platform | tenant, organization, department, team, membership, principal + kinds, plan, subscription, application, app_installation, config, feature_flag |
| iam | credential, session, device, api_key, permission, role, role_permission, role_grant, policy, relation_tuple |
| events | outbox, inbox, dead_letter, webhook_subscription, webhook_delivery |
| notifications | notification, notification_preference, template, delivery |
| files | file_object, document, document_version |
| audit | audit_entry (append-only, partitioned) |
| ai | agent_run, tool_call, knowledge_chunk (pgvector), usage_meter |
| app_engineering, app_billing, … | each application's private tables |

### Why tables live where - and cross-schema references

- **Single writer per schema.** Only the owning module writes its schema. This lets a
  schema become a service later.
- **References point to the kernel, never sideways.** An app table may FK to
  `platform.organization(id)` and `platform.principal(id)`. The kernel never FKs into
  an app; apps never FK into each other. Cross-app relationships are ids + events, not
  foreign keys.
- **Snapshot where immutability matters.** Billing copies the client's name/address
  onto the invoice at send-time so a later client edit can't rewrite history.

### Multi-tenancy, RLS, indexing

- **Tenancy columns** - every tenant-owned row carries `tenant_id` (+ `org_id` where
  relevant). Ambient request context supplies them; app code never hand-threads them.
- **Row-Level Security** - connection sets `app.current_org_id` / `app.current_tenant_id`
  GUCs per transaction; RLS policies `USING (org_id = current_setting(...))`.
  Defense-in-depth beneath the app scoping - a forgotten `WHERE` still can't leak.
- **Indexing** - composite indexes lead with `(org_id, …)`; FK columns indexed; partial
  indexes on hot statuses; GIN for jsonb/search. Index reads, don't over-index writes.
- **Backups** - continuous WAL archiving (PITR) + daily base backups + *tested*
  restores. Per-tenant logical export for GDPR portability. Defined retention windows.

### Migration strategy

- **Per-schema migrations.** Kernel migrations are gated + reviewed; app migrations run
  through the registry's upgrade hook so an app upgrade and its schema change move
  together.
- **Expand / contract, forward-only in prod.** Add (expand), backfill, dual-write, cut
  over, then remove (contract). No destructive step is coupled to a deploy.
- **Validate multi-schema early.** Prisma's multi-schema + RLS is powerful but finicky -
  a spike in M0 confirms it or triggers the single-schema-with-conventions fallback.

> **Risk · RLS + connection pooling.** RLS relies on a per-transaction GUC; with a
> pooler (PgBouncer in transaction mode) you must set it inside every transaction, not
> per-session, or a pooled connection leaks the previous tenant's context. Bake the
> GUC-set into the ambient-context transaction wrapper and test it adversarially.

---

## 8. Repository & folder structure

The layout enforces the architecture. If the kernel could import an app, someone
eventually would - so the folders make it impossible.

```
grovyn-platform/
├─ apps/
│  ├─ api/                    # NestJS modular monolith (one deployable)
│  │  └─ src/
│  │     ├─ kernel/           # platform services - imports NO app
│  │     │  ├─ identity/ authorization/ tenancy/
│  │     │  ├─ registry/ events/ notifications/
│  │     │  ├─ storage/ search/ ai/ audit/
│  │     │  ├─ entitlements/ billing/ config/
│  │     │  └─ flags/ secrets/ jobs/ webhooks/ scheduler/
│  │     ├─ apps/             # bounded contexts - each owns a schema
│  │     │  ├─ engineering/ billing/ crm/ …
│  │     └─ bootstrap/        # registry loader, wiring, RLS wrapper
│  └─ web/                    # TanStack Start shell
│     └─ src/{ shell/, apps/<key>/, router.tsx }
├─ packages/
│  ├─ ui/          # design system - the single base standard
│  ├─ contracts/   # integration events + published read interfaces
│  ├─ sdk/         # PlatformApp contract, manifest types, can()/event helpers
│  └─ config/      # shared eslint / tsconfig / prettier
├─ tools/
│  ├─ cli/         # grovyn CLI - scaffold, migrate, sync manifest
│  └─ generators/  # `new app`, `new entity`, `new event` templates
├─ testing/
│  ├─ fixtures/ conformance/   # the app-conformance test suite (§9)
│  └─ e2e/
├─ infra/               # IaC, docker, migrations runner, CI pipelines
└─ prisma/{ kernel/, apps/ }
```

| Folder | Why it exists |
| --- | --- |
| packages/contracts | The *only* place apps share types. Event schemas + read interfaces live here so coupling is explicit and versioned. |
| packages/sdk | What an app author imports: the `PlatformApp` contract, manifest types, PDP helper, event publish/subscribe. Extracted from two real apps, not before. |
| tools/cli + generators | Adding an app is a *generated, guard-railed* act, not copy-paste. The generator emits a conformant skeleton. |
| testing/conformance | A suite every app must pass: tenant scoping, manifest validity, permission declarations, event contracts. CI blocks non-conformant apps. |
| infra | Reproducible environments + migration runner + CI. The platform's operational truth. |

---

## 9. Development rules

Enforced by lint, conformance tests, and review - not goodwill.

### Forbidden

- An app reading or writing **another app's schema**, or FK-ing across app schemas.
- **Unscoped queries** - any tenant-owned query without org/tenant scope.
- **Roles or permissions in the JWT**, or any authorization decision made outside the
  PDP.
- Calling a **provider SDK directly** (Anthropic, S3, SMTP) instead of the kernel
  service.
- Emitting an event by writing to the bus directly, **bypassing the outbox**.
- A **synchronous cross-app write** on a request path; secrets in code; a new app
  without a manifest.

### Every app MUST

- Ship a **manifest** and own exactly one **schema**.
- Scope every row and query by `org_id`/`tenant_id` and pass RLS conformance tests.
- Declare every **permission** it enforces, and enforce every endpoint through the PDP.
- Emit state changes as **domain events via the outbox**; publish cross-app facts as
  *versioned integration events*.
- Depend on other apps only through `packages/contracts` - never imports.
- Pass the **conformance suite** in CI before merge.

### How a new app is added

1. **Scaffold** with `grovyn new app <key>` - emits schema, manifest, module skeleton,
   conformance tests.
2. **Model the domain** in the app's schema; expose APIs behind PDP-guarded
   controllers.
3. **Declare surface** in the manifest: nav, permissions, roles, events, AI tools,
   entitlement.
4. **Register & migrate** - the loader syncs the catalog; migrations run via the
   upgrade hook.
5. **Prove conformance**, review, ship behind a feature flag.

### How apps expose their surface

- **APIs** - REST controllers under the app's route prefix, each declaring the
  permission it needs; the PDP guard enforces it uniformly.
- **Permissions** - declared in the manifest as `app:resource:action`; synced to the
  catalog at boot; bundled into the app's default roles.
- **AI tools** - declared in the manifest with an input schema + required permission;
  the AI gateway exposes them to agents, which invoke them *as a principal* through the
  PDP.
- **Events** - integration events declared in the manifest + schema'd in
  `packages/contracts`; emitted via the outbox; consumed by name, never by reaching
  into the producer.

---

## 10. Future compatibility

The test of the design: can each future direction land as an *addition*, never a
rewrite?

| Direction | How it lands without breaking anything |
| --- | --- |
| CRM | New app + schema. Contacts project from a kernel Party/Directory concept; `crm.deal.won` → Billing drafts an invoice. |
| HRMS | New app; `dependsOn: directory`. Uses the existing Department tree + manager edges from `membership`; consumes `recruitment.candidate.hired`. |
| Inventory / Procurement | New apps + schemas; emit stock/PO events to Finance; reuse storage for documents. No kernel change. |
| Hospital / School (regulated) | Vertical apps; the tenant flips to a *dedicated database* for residency/isolation - same code path, because tenancy was pooled-and-isolatable from day one. |
| Marketplace | The app catalog already exists (§4). Add listings, ratings, and vendor payouts; third-party apps register through the same manifest. |
| Third-party plugins | Publish `packages/sdk`; plugins subscribe to integration events + webhooks and mount UI slots. They authenticate as scoped principals and pass the same PDP. |
| Microservices | A hot schema → its own database → its own service. Consumers already talk via versioned events + read interfaces, so extraction is a deployment change, not a contract change. |

> **The invariant.** Every future item touches *only* new app schemas, new manifest
> declarations, and new event subscriptions. The four things that never churn - the PDP
> signature, the event envelope, the tenancy model, and the registry manifest - are the
> reason "hundreds of apps" stays a content problem.

---

## 11. Horizon 1 - implementation milestones

Seven milestones. Each is independently reviewable, produces a demonstrable capability,
and - the governing rule - **is not built until its own milestone specification is
written and approved.** No milestone starts before the previous one's exit criteria are
met.

### M0 · Foundation & guardrails
Monorepo, CI, the ambient-tenant + RLS transaction wrapper, the conformance-test
scaffold, and the *Prisma multi-schema + RLS spike* that de-risks §7.
**Exit:** an empty app passes conformance; RLS proven under a pooler.

### M1 · Identity & principals
Principal supertype (User / Service Account / Agent), argon2id credentials, sessions,
rotating refresh with reuse detection, device management.
**Exit:** full password + refresh lifecycle; sessions listable & revocable.

### M2 · Tenancy & hierarchy
Tenant → Org → Department (tree) → Team → Membership, with manager edges and
context-switching. Ambient scoping enforced end to end.
**Exit:** a user in two orgs switches context; every query is scoped & RLS-guarded.

### M3 · Authorization engine
Permission catalog, roles, grants, the PDP with conditions, effective-set caching - run
in *shadow mode* beside today's enum checks, logging disagreements.
**Exit:** PDP matches legacy checks on real traffic; `/me/permissions` live.

### M4 · Application registry
Manifest contract, registry loader + catalog sync, `app_installation` lifecycle
(enable/disable/upgrade/archive/uninstall), registry-driven nav + palette.
**Exit:** a stub app installs, surfaces nav, and its permissions appear in the catalog.

### M5 · Engineering as the first app
Re-home the existing Engineering domain onto the kernel via strangler +
expand/contract; cut its guards over from enum roles to the PDP behind a flag.
**Exit:** Engineering runs entirely on the platform; legacy `User.orgId`/role retired.

### M6 · Shared services Engineering needs
Events (outbox/inbox/DLQ), generalized Notifications, and Audit - the kernel services
the first app exercises, hardened by real use.
**Exit:** Engineering emits versioned events, drives notifications off them, and writes
a complete audit trail.

> **Governing rule of Horizon 1.** Each milestone is gated by a written spec reviewed
> and approved *before* implementation, and reviewed again against its exit criteria
> *before* the next begins. The definition of done for Horizon 1 is singular: **adding
> the second app (Billing) is a generator-driven, documented, low-risk act** - because
> the kernel has already been proven against software we trust.
