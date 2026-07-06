# Architecture Readiness Review — Grovyn One → Grovyn OS

> **Status:** review of Draft v1 ([`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md),
> [`02-IMPLEMENTATION-SPEC.md`](./02-IMPLEMENTATION-SPEC.md)) against the **actual**
> repository at `HEAD`. **Author role:** Principal Software Architect.
> **No code was modified.** Evidence is cited by file path.

## Headline finding

The codebase is **further along the platform path than Draft v1 assumed.** Three of the
hardest migrations are already substantially done:

1. **Authorization is already resolved live from `Membership`, not from the JWT.**
   `backend/src/platform/auth/strategies/jwt.strategy.ts` re-reads the membership role
   on *every* request and returns the fresh role — the token's baked role is ignored
   for authz. Draft v1's "roles in the JWT" challenge is **mostly already solved.**
2. **`Membership` is already the source of truth** with legacy `User.orgId`/`role`
   maintained by an explicit expand/contract shim (`auth.service.ts` →
   `syncLegacyUserFields`, `touchMembership`).
3. **Multi-org context switching already exists** end-to-end (`/auth/switch-org`,
   `OrganizationSwitchLog`, the frontend org switcher + query reset).

This means Horizon 1 is less "build the kernel" and more "**generalize, formalize, and
name** mechanisms that already exist." The two genuinely greenfield kernel pieces are
the **permission/PDP layer** and the **application registry**. Everything else is
refactor or reuse.

Conversely, four subsystems in Draft v1 **do not exist at all** today and are pure new
build: **Tenant** (above Organization), **Permissions/PDP**, **Application Registry**,
and **Audit**. **AI** exists only in the GrovynDashboard app being absorbed, not in
grovyn-one.

---

## Subsystem reviews

Difficulty is 1 (trivial) → 10 (multi-quarter, high-risk). Horizon per §26 of the
architecture doc.

### 1. Authentication
- **Current State.** JWT access + rotating refresh; `argon2`? → **bcrypt** today.
  Passport `jwt` + `jwt-refresh` strategies. `Session` model for refresh. Tokens signed
  with `{ sub, email, orgId, role }` (`auth.service.ts:generateTokens`). `/auth/login`,
  `/refresh`, `/switch-org`, `/me`, accept-invite, change-password. Frontend stores
  tokens in `localStorage` (`src/lib/auth.ts`) with transparent refresh (`src/lib/api.ts`).
- **Target State.** Principal supertype (User/ServiceAccount/Agent); argon2id; access
  token carries active context only; IdP boundary; API keys; agent tokens; MFA/SSO
  deferred.
- **Migration Strategy.** Keep the token/refresh/session machinery. (a) Introduce a
  `Principal` abstraction over `User`. (b) Swap bcrypt→argon2id behind a verifier that
  rehashes on next login. (c) Wrap `JwtService.sign` behind an `IdentityIssuer`
  interface (the IdP seam). API keys + agent auth are additive.
- **Breaking Changes.** Password hash migration (transparent, on-login rehash). Token
  `role` claim becomes advisory (already true in practice).
- **Compatibility Notes.** Refresh/session/switch-org flows are directly reusable. No
  frontend auth change needed for H1.
- **Difficulty.** **4/10.** **Horizon 1** (Principal + IdP seam); SSO/MFA/API-keys **H3**.

### 2. Authorization
- **Current State.** RBAC via enum `Role { OWNER ADMIN MEMBER }`. `RolesGuard`
  (`common/guards/roles.guard.ts`) checks `requiredRoles.includes(user.role)` where
  `user.role` is the **live** membership role from `jwt.strategy`. `@Roles(...)` +
  `@UseGuards(JwtAuthGuard, RolesGuard)` opt-in per controller/method. Org-scoping is
  manual `where: { orgId }` in each service. **No permission strings, no PDP, no ABAC,
  no scope beyond org, no Permission/Role tables.**
- **Target State.** `check(principal, action, resource, ctx)` PDP; `app:resource:action`
  permissions; roles as bundles; grants at org/dept/team/self; conditions
  (ownership/manager/dept-subtree); effective-set cache; ReBAC seam.
- **Migration Strategy.** New `iam` tables (permission, role, role_permission,
  role_grant, policy). Build the PDP; run it in **shadow mode** beside `RolesGuard`,
  logging disagreements; then a `PolicyGuard` that consults the PDP, cutting over
  controller-by-controller behind a flag. Seed system roles = today's three enum values.
- **Breaking Changes.** Every `@Roles(...)` site eventually becomes a declared
  permission. Ad-hoc `me.role === 'OWNER'||'ADMIN'` checks (frontend + services)
  migrate to permission checks.
- **Compatibility Notes.** The guard/decorator pattern is a clean insertion point — the
  PDP hides behind the same `@UseGuards`. Live-role resolution means the cache design
  must match today's freshness guarantee.
- **Difficulty.** **8/10** (greenfield, correctness-critical, wide blast radius).
  **Horizon 1** (core PDP + shadow); custom roles/delegation **H3**.

### 3. Membership model
- **Current State.** `Membership { userId, orgId, role, status, managerId, department,
  jobTitle, @@unique([userId,orgId]) }` — **already the authoritative** per-(user,org)
  record. `MembershipStatus` enum exists. Legacy `User.orgId`/`role` dual-written via
  `syncLegacyUserFields`.
- **Target State.** Add `reports_to_membership_id` (manager edge distinct from dept
  tree), `teamIds` link, title/position. Retire legacy `User.orgId`/`role`.
- **Migration Strategy.** Additive columns; then contract-phase removal of legacy User
  fields once no reader remains (grep shows `syncLegacyUserFields` is the only writer to
  keep in sync).
- **Breaking Changes.** Eventual drop of `User.orgId`/`User.role` (well-contained;
  legacy shim already isolates readers).
- **Compatibility Notes.** This is the single biggest head-start in the repo. Manager
  edge partly exists as `managerId` — needs re-pointing to membership, not user.
- **Difficulty.** **3/10.** **Horizon 1.**

### 4. Organization model
- **Current State.** `Organization` is the top scope (no Tenant above it). Everything
  FKs to `orgId`. `OrganizationSettings` model exists but is **schema-only / not wired**.
  `OrganizationSwitchLog` wired. Slug, logoUrl, linear fields present.
- **Target State.** Introduce **`Tenant`** above Organization (billing/brand/isolation).
  Add `Department` (self-referential tree) and `Team`. Wire `OrganizationSettings`.
- **Migration Strategy.** Create `Tenant`; backfill one Tenant per existing Org; add
  `tenantId` FK to Organization. Department/Team are new tables. Reversible, additive.
- **Breaking Changes.** None immediately — Tenant is inserted above; existing `orgId`
  scoping unchanged.
- **Compatibility Notes.** All app data stays `orgId`-scoped; Tenant is mostly a
  billing/isolation parent in H1. Department/Team have no consumers yet — safe to add.
- **Difficulty.** **4/10** (Tenant) / **5/10** (Dept tree + scoping). **Horizon 1.**

### 5. Engineering module
- **Current State.** `backend/src/engineering/*` (check-ins, goals, reviews,
  recognition, people, task-updates, dashboard, leaderboard, search, reminders) +
  `workspace/`. All org-scoped, guard-protected. Frontend routes mirror them. This is a
  clean, working bounded context already.
- **Target State.** Becomes the **first registered application** with a manifest, its
  own schema (`app_engineering`), declared permissions, and events emitted via outbox.
- **Migration Strategy.** Strangler: (1) wrap modules under an app boundary + manifest
  (logical, no data move); (2) cut guards to PDP; (3) *optionally, last* move tables to
  an `engineering` schema.
- **Breaking Changes.** Internal only (import paths, guard swap). No user-facing change.
- **Compatibility Notes.** The best possible H1 validator — real, trusted software to
  prove the kernel against. Its events + notifications exercise the shared services.
- **Difficulty.** **5/10** (mostly mechanical + the PDP cutover). **Horizon 1 (M5).**

### 6. Navigation
- **Current State.** Static grouped `nav` array in `src/components/app-shell.tsx`
  (lines 36–52). **Not** role-filtered today; no launcher; no registry.
- **Target State.** Registry-driven nav + app launcher + command palette, filtered
  `installed ∩ entitled ∩ permitted`.
- **Migration Strategy.** Replace the static array with a selector over the client app
  manifests; add the launcher as a new shell surface. Command palette already exists
  (`command-palette.tsx`) — point it at the registry.
- **Breaking Changes.** The hard-coded `nav` is deleted (low risk, one file).
- **Compatibility Notes.** `AppShell` structure, org switcher, palette all reusable.
- **Difficulty.** **4/10.** **Horizon 1 (M4)** for registry-driven nav; launcher **H2**.

### 7. Routing
- **Current State.** TanStack Start file-based routing (`src/routes/*`,
  `routeTree.gen.ts`); global auth gate in `__root.tsx beforeLoad`; flat route names
  (`/goals`, `/people`). No per-app namespacing; no per-route role gate.
- **Target State.** Per-app URL prefixes (`/engineering/*`, `/billing/*`), lazy-loaded
  app modules under `src/apps/<key>/routes`.
- **Migration Strategy.** New apps use `/billing/*` immediately. Engineering routes can
  keep flat paths short-term (redirect later) to avoid breaking bookmarks.
- **Breaking Changes.** If Engineering routes are re-prefixed, add redirects.
- **Compatibility Notes.** File-based routing supports this natively; low friction.
- **Difficulty.** **3/10.** **Horizon 1** (structure) / **H2** (re-home Engineering paths).

### 8. Backend modules (NestJS structure)
- **Current State.** `AppModule` → `PlatformModule` (auth, users, orgs, invitations,
  linear, notifications, data-management) + `EngineeringModule` + `WorkspaceModule` +
  `PrismaModule` + `StorageModule`. Clean modular layering; no ambient tenant context
  (orgId hand-threaded); no outbox; controllers sometimes hold logic.
- **Target State.** Explicit `kernel/` vs `apps/` split; ambient tenant context
  (AsyncLocalStorage); registry loader; four-layer discipline.
- **Migration Strategy.** Reorganize into `kernel/` and `apps/`; introduce the ALS
  request-context provider + transaction wrapper (this is where RLS GUC-set lands).
  Convert manual `orgId` threading to ambient reads incrementally.
- **Breaking Changes.** Import-path churn; service signatures drop explicit `orgId`.
- **Compatibility Notes.** Existing module boundaries map cleanly to the target.
- **Difficulty.** **6/10** (ALS + folder split touch every service). **Horizon 1 (M0/M2).**

### 9. Prisma schema
- **Current State.** PostgreSQL, single schema, ~25 models. `Membership`,
  `OrganizationSwitchLog`, `Session`, `NotificationPreference`, `PushDevice` etc.
  present. Legacy `User.orgId`/`role`. No `Tenant`, no Permission/Role tables, no
  Department/Team, no Outbox, no Audit, no multi-schema, no RLS.
- **Target State.** Multi-schema (`platform`/`iam`/`events`/`audit`/`app_*`), Tenant +
  Dept/Team + authz tables + outbox/inbox + audit, RLS policies.
- **Migration Strategy.** Additive migrations per concern; **M0 spike must validate
  Prisma multi-schema + RLS** before committing (documented fallback: single schema +
  conventions). Expand/contract for legacy-field removal.
- **Breaking Changes.** Schema-qualified table moves (if multi-schema adopted) are the
  riskiest; keep them last and per-context.
- **Compatibility Notes.** Existing models are well-formed and org-indexed; net-new
  tables don't disturb them.
- **Difficulty.** **7/10** (multi-schema + RLS is the top data risk). **Horizon 1.**

### 10. API contracts
- **Current State.** REST; global response envelope (`{ success, data }` /
  `{ data, meta }`) via `ResponseInterceptor`; frontend `api.ts` unwraps it. Org derived
  from JWT — client never sends `orgId`. No versioning; no published cross-module
  contracts package.
- **Target State.** Same REST style + `/authz/*`, `/registry`, `/me/permissions`;
  `packages/contracts` for integration events + read interfaces; per-app route prefixes.
- **Migration Strategy.** Keep the envelope (frontend depends on it). Add new kernel
  endpoints. Extract shared DTOs/events to `packages/contracts` when the 2nd app needs
  them (not before).
- **Breaking Changes.** None to existing endpoints.
- **Compatibility Notes.** Envelope + client refresh logic are keepers.
- **Difficulty.** **3/10.** **Horizon 1** (new endpoints) / **H2** (contracts package).

### 11. Frontend architecture
- **Current State.** TanStack Start + React Query; `AppShell` chrome; `OrganizationProvider`
  (`/auth/me` query + switch); ad-hoc role gating (`me.role === 'OWNER'||'ADMIN'`
  inline across ~8 route files). shadcn + custom `primitives.tsx`. No shell/app split;
  no `packages/ui`; no client manifest.
- **Target State.** Shell + lazy app modules under `src/apps/<key>`; shared `packages/ui`;
  registry-driven nav; permission-aware gating from `/me/permissions`.
- **Migration Strategy.** Introduce the shell/app split with Billing as the first app
  module. Move primitives/ui to `packages/ui`. Replace inline role checks with a
  `usePermissions()` hook backed by `/me/permissions`.
- **Breaking Changes.** Inline role checks refactored; `nav` array removed.
- **Compatibility Notes.** `OrganizationProvider`, api client, React Query patterns,
  primitives are all reusable as-is.
- **Difficulty.** **5/10.** **Horizon 1** (permission hook) / **H2** (packages/ui, app split).

### 12. Storage
- **Current State.** **R2 (S3-compatible) via `StorageService`** (`platform/storage`) —
  presign, `buildKey(prefix, ext)`, publicUrl, delete; domain-agnostic and explicitly
  designed for reuse. Registered globally-ish via `StorageModule`.
- **Target State.** Same service + a document/artifact table (versioning/retention) +
  non-image validation path + tenant-namespaced keys.
- **Migration Strategy.** Extend key prefix to include tenant; add a `document` table
  for generated PDFs; add a PDF/document upload DTO. Pure addition.
- **Breaking Changes.** None.
- **Compatibility Notes.** **This is production-ready kernel already.** Reuse verbatim.
- **Difficulty.** **2/10.** **Horizon 1/2** (as apps need it).

### 13. Notifications
- **Current State.** In-app notifications + **FCM push** (`firebase-push.provider`) +
  `NotificationPreference` + `PushDevice` + socket + bell UI. Real, working, but
  Engineering-specific (types hard-coded, not manifest-registered).
- **Target State.** Generalized: manifest-registered types, channel abstraction
  (email/SMS/webhook added), event-driven delivery, preference center generated.
- **Migration Strategy.** Extract the channel/provider seam; make types a registry
  concern; drive off the event bus. Reuse preference + push + socket infra.
- **Breaking Changes.** Notification-type enum becomes registry-driven (internal).
- **Compatibility Notes.** ~70% reusable; the hard part (push, prefs, realtime) is done.
- **Difficulty.** **5/10.** **Horizon 1 (M6)** — Engineering exercises it.

### 14. Audit
- **Current State.** **Does not exist** (grep for "audit" in backend returns nothing).
  `OrganizationSwitchLog` and `GoalHistory` are the only audit-adjacent traces.
- **Target State.** Kernel `AuditService` + immutable, partitioned `audit_entry`; PDP
  decisions + all mutations logged.
- **Migration Strategy.** Greenfield. Introduce alongside the event bus (audit is an
  event consumer). Backfill not required.
- **Breaking Changes.** None (new).
- **Compatibility Notes.** `GoalHistory`/`OrganizationSwitchLog` become specialized
  producers into the general log later.
- **Difficulty.** **4/10.** **Horizon 1 (M6)** foundation; hardening **H3**.

### 15. AI
- **Current State.** **None in grovyn-one.** AI exists only in the **GrovynDashboard**
  app being absorbed (HuggingFace/Mistral document drafting + brittle JSON repair).
- **Target State.** Kernel AI gateway (Claude), agent runtime (agents as scoped
  principals), tool registry, per-tenant cost metering, governance.
- **Migration Strategy.** Greenfield gateway in H2; port Billing's drafting onto it with
  Claude (deletes the JSON-repair code). Do **not** lift the HuggingFace integration.
- **Breaking Changes.** None (new); GrovynDashboard's AI is rebuilt, not ported.
- **Compatibility Notes.** Nothing to reuse from grovyn-one; the governance/PDP hooks
  depend on §2 authz.
- **Difficulty.** **7/10.** **Horizon 2+** (gateway) / **H4** (agent runtime).

### 16. Existing R2 integration
- **Current State.** AWS SDK v3 `S3Client` → R2 (`r2.cloudflarestorage.com`,
  `region:'auto'`, checksum `WHEN_REQUIRED`); env `R2_*`; UUID keys, never trusts client
  filename; presign pins ContentType+ContentLength.
- **Target State.** Unchanged; wrap under the Files service naming + tenant prefixing.
- **Migration Strategy.** None structural — rename/relocate under `kernel/storage`.
- **Breaking Changes.** None.
- **Compatibility Notes.** **Keep entirely.** Security posture is already correct.
- **Difficulty.** **1/10.** **Reuse as-is.**

### 17. Existing upload system
- **Current State.** `src/lib/uploads.ts`: presign → direct `XMLHttpRequest PUT` to R2
  with progress/abort; `uploadAvatar`, `uploadOrgLogo`; **image-MIME validation only**.
  `avatar-uploader.tsx` UI.
- **Target State.** Same flow + a document/PDF validation path + generic attachment
  entity.
- **Migration Strategy.** Add a non-image validation branch + a documents upload helper.
  Additive.
- **Breaking Changes.** None.
- **Compatibility Notes.** The presign→PUT pattern is the reference for all future
  uploads. Reuse.
- **Difficulty.** **2/10.** **Horizon 1/2.**

### 18. Existing permissions
- **Current State.** **No permission system** — only the enum `Role`. Authorization is
  role-equality (`RolesGuard`) + inline frontend role checks. No `app:resource:action`,
  no catalog, no scopes.
- **Target State.** Full permission catalog + PDP (§2 of the review, §3/§15 of the spec).
- **Migration Strategy.** Greenfield; map today's three roles to seed system roles;
  shadow-mode rollout.
- **Breaking Changes.** All authorization call sites eventually re-expressed as
  permissions.
- **Compatibility Notes.** Because role is already resolved live, the freshness contract
  the PDP must honor is already established.
- **Difficulty.** **8/10** (same as §2 — it *is* §2). **Horizon 1.**

### 19. Existing roles
- **Current State.** `enum Role { OWNER ADMIN MEMBER }` on `Membership` (+ legacy on
  User). Invite flow assigns ADMIN/MEMBER (`people.index.tsx`); OWNER special-cased.
- **Target State.** These become **seed system roles** = permission bundles; app roles
  and tenant-custom roles layered on top.
- **Migration Strategy.** Preserve the three as system roles with fixed bundles; no data
  loss. Add Tenant Owner / Platform tiers above.
- **Breaking Changes.** None to the three roles' meaning; they gain a permission mapping.
- **Compatibility Notes.** Direct, clean carry-over.
- **Difficulty.** **2/10.** **Horizon 1.**

### 20. Existing middleware
- **Current State.** **No NestJS middleware** (grep for `NestMiddleware`/`configure(consumer`
  empty). Cross-cutting concerns are `ValidationPipe`, `ResponseInterceptor`,
  `HttpExceptionFilter`, `ThrottlerModule`, guards. No `APP_GUARD` (guards are per-controller).
- **Target State.** Add an ambient-tenant-context middleware/interceptor (ALS) that also
  sets the RLS GUC per transaction; consider a global `PolicyGuard`.
- **Migration Strategy.** Introduce the ALS context as an interceptor/middleware early
  (M0/M2). Optionally promote guards to global with `@Public()` opt-out (decorator
  already exists).
- **Breaking Changes.** Global guard adoption would require auditing every currently
  unguarded route.
- **Compatibility Notes.** Clean slate — no legacy middleware to unwind.
- **Difficulty.** **4/10.** **Horizon 1.**

### 21. Existing guards
- **Current State.** `JwtAuthGuard` (honors `@Public()`), `RolesGuard` (live-role
  equality). Decorators: `@Roles`, `@CurrentUser`, `@OrgId`, `@Public`. Opt-in per
  controller.
- **Target State.** A `PolicyGuard` consulting the PDP replaces/augments `RolesGuard`;
  `JwtAuthGuard` largely unchanged (issuance moves behind the IdP seam).
- **Migration Strategy.** Add `PolicyGuard` in shadow first; migrate `@Roles` →
  `@RequirePermission` per controller behind a flag. `JwtAuthGuard`/decorators stay.
- **Breaking Changes.** `@Roles` decorator eventually deprecated.
- **Compatibility Notes.** **The guard/decorator seam is the single cleanest insertion
  point in the whole backend** — the PDP hides entirely behind existing `@UseGuards`.
- **Difficulty.** **5/10** (mechanical breadth). **Horizon 1.**

### 22. Existing layouts
- **Current State.** `AppShell` (sidebar 240px, header, org switcher, palette, theme
  toggle, notifications, optional right panel), mobile drawer, `isSwitching` overlay.
  Solid, single shell.
- **Target State.** Same shell, generalized to app-agnostic + launcher surface; nav from
  registry.
- **Migration Strategy.** Extract the static `nav`; add launcher; otherwise keep. Move
  to `apps/web/src/shell`.
- **Breaking Changes.** Only the `nav` array.
- **Compatibility Notes.** **High reuse.** This *is* the "base standard" chrome the user
  wants preserved.
- **Difficulty.** **3/10.** **Horizon 1.**

### 23. Existing design system
- **Current State.** Tailwind v4 (CSS-config, `@theme inline`, OKLCH tokens in
  `styles.css`), `components.json`, ~45 shadcn `ui/*`, higher-level `primitives.tsx`
  (`PageHeader`, `Card`, `Avatar`, `StatusBadge`, `Metric`, etc.). No literal "grovyn
  green" token; brand via logo + `--success`/`--info`.
- **Target State.** Same tokens/components extracted to `packages/ui`, consumed by all
  apps. The mandated single base standard.
- **Migration Strategy.** Lift `ui/` + `primitives.tsx` + `styles.css` tokens into
  `packages/ui`; apps import from it. No visual change.
- **Breaking Changes.** Import paths only.
- **Compatibility Notes.** **Reuse wholesale** — this is exactly the standard the whole
  effort is meant to preserve.
- **Difficulty.** **3/10.** **Horizon 1/2** (when the 2nd app needs shared UI).

### 24. Existing utilities
- **Current State.** `src/lib/*`: `api.ts` (client+refresh), `auth.ts` (token store),
  `organization-context.tsx`, `theme.ts`, `transforms.ts` (initials, avatar color),
  `uploads.ts`, `firebase.ts` (FCM only), `notifications.ts`, `workspace.ts`,
  `error-capture.ts`. Backend `common/utils` (encryption, generate-password).
- **Target State.** Most become kernel/SDK utilities; `firebase.ts` stays FCM-only under
  notifications.
- **Migration Strategy.** Sort into `packages/sdk` (api, auth, permissions helper) vs
  app-local. Additive.
- **Breaking Changes.** Import paths.
- **Compatibility Notes.** Nearly all reusable; `transforms`, `api`, `theme` are keepers.
- **Difficulty.** **2/10.** **Horizon 1/2.**

---

# Architecture Readiness Report

### ✅ Already aligned (reuse — little/no change)
- **R2 storage integration** (§16) — production-ready kernel, correct security posture.
- **Upload presign→PUT pattern** (§17) — the reference for all future uploads.
- **Design system / shadcn / primitives / tokens** (§23) — the base standard to preserve.
- **AppShell chrome, org switcher, command palette, theme** (§22).
- **Refresh/session/switch-org auth flows** (§1) and **live role resolution** (§2).
- **`Membership` as source of truth** (§3) with expand/contract shim already running.
- **Response envelope + api client** (§10) and most **frontend utilities** (§24).

### 🟡 Needs refactoring (keep the substance, restructure/generalize)
- **Backend module layout** → `kernel/`+`apps/` split + ambient tenant context (§8).
- **Navigation** → registry-driven, drop the static `nav` array (§6).
- **Routing** → per-app prefixes + lazy app modules (§7).
- **Guards/middleware** → add `PolicyGuard` (shadow→cutover) + ALS/RLS wrapper (§20/§21).
- **Notifications** → generalize types + channels off the event bus (§13).
- **Frontend gating** → replace inline `me.role` checks with `usePermissions()` (§11).
- **Engineering module** → wrap as the first registered app (§5).
- **Organization model** → insert Tenant above; add Department/Team; wire
  `OrganizationSettings` (§4).
- **Roles** → become seed system-role permission bundles (§19).

### 🔴 Must be redesigned / newly built (greenfield kernel)
- **Permission engine + PDP** (§2/§18) — the largest new build; correctness-critical.
- **Application Registry + manifests + installation lifecycle** — no equivalent exists.
- **Tenant entity** and the tenancy isolation layer (RLS + ambient scoping).
- **Event system** (outbox/inbox/DLQ) — none today.
- **Audit** (§14) — none today.
- **AI gateway / agent runtime** (§15) — none in grovyn-one; H2+.
- **Prisma multi-schema + RLS** (§9) — must be spiked before adoption.

### ❌ Remove entirely
- **The static `nav` array** in `app-shell.tsx` (superseded by the registry).
- **Legacy `User.orgId` / `User.role`** — only after the contract phase; `syncLegacyUserFields`
  is the shim to delete last.
- **GrovynDashboard's stack wholesale** — its Express/Mongo backend, Zustand transform
  layer, HuggingFace AI, and own JWT auth are **not** ported; only its *domain logic*
  (tax engine, numbering, amount-in-words, document models) is rebuilt on the platform.
- **Inline `me.role === 'OWNER'||'ADMIN'` checks** (frontend) once `usePermissions()`
  lands.

---

## Dependency graph — safest implementation order

```
                    ┌─────────────────────────────┐
                    │ M0  Foundation & guardrails  │
                    │ monorepo · CI · ALS context  │
                    │ · RLS+multi-schema SPIKE     │
                    │ · conformance scaffold       │
                    └──────────────┬───────────────┘
                                   │ (RLS decision gates everything data-shaped)
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
   ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐
   │ M1 Identity /    │  │ M2 Tenancy &      │  │ (design system → │
   │ Principal        │  │ hierarchy         │  │  packages/ui,    │
   │ (argon2, IdP     │  │ Tenant·Dept·Team· │  │  parallelizable) │
   │  seam)           │  │ ambient scoping   │  └──────────────────┘
   └────────┬─────────┘  └─────────┬─────────┘
            │                      │  (Membership already exists → low cost)
            └───────────┬──────────┘
                        ▼
         ┌────────────────────────────────┐
         │ M3 Authorization / PDP         │   ← depends on Principal + Tenancy
         │ permission catalog · grants ·  │     run in SHADOW beside RolesGuard
         │ PDP · effective-set cache      │
         └───────────────┬────────────────┘
                         ▼
         ┌────────────────────────────────┐
         │ M4 Application Registry        │   ← depends on Authz (permission sync)
         │ manifest · loader · install    │     + Tenancy (installation scope)
         │ lifecycle · registry-driven nav│
         └───────────────┬────────────────┘
                         ▼
         ┌────────────────────────────────┐
         │ M5 Engineering as first app    │   ← depends on Registry + PDP cutover
         │ strangler · guard→PDP · manifest│
         └───────────────┬────────────────┘
                         ▼
         ┌────────────────────────────────┐
         │ M6 Shared services             │   ← Events first, then Notifications
         │ Events(outbox/inbox/DLQ) →     │     (refactor) + Audit (new) consume it
         │ Notifications · Audit          │
         └────────────────────────────────┘
                         │
                         ▼   (Horizon 2 — proven kernel)
              Billing app · AI gateway · packages/ui · app launcher
```

**Ordering rationale.** The RLS/multi-schema decision (M0) gates the physical data
design, so it comes first. Identity and Tenancy are independent and parallelizable; both
feed the PDP (M3), which must exist before the Registry (M4) can sync permissions, which
must exist before Engineering can register as an app (M5). Shared services (M6) come last
in H1 because Engineering is the consumer that hardens them. The design-system extraction
is off the critical path and can run in parallel whenever convenient.

---

## Architectural risks that could force a rewrite if ignored today

1. **RLS + connection-pooler correctness (CRITICAL).** RLS depends on a per-transaction
   GUC; under PgBouncer transaction pooling, a mis-scoped connection leaks the prior
   tenant's context. If the ambient-context transaction wrapper isn't the *only* path to
   the DB from day one, retrofitting it later is a cross-cutting rewrite. **Decide and
   prove in M0.**
2. **PDP freshness vs. cache (CRITICAL).** Today authz is *always live* (per-request
   membership read). If the effective-set cache is introduced without matching that
   freshness contract (invalidation on grant change), you silently weaken the current
   security guarantee. Design invalidation before the cache.
3. **Multi-schema commitment before the spike (HIGH).** Adopting Prisma multi-schema
   across the codebase and then discovering tooling limits (cross-schema relations,
   migration ergonomics) is a rewrite. The M0 spike with a documented single-schema
   fallback is non-negotiable.
4. **`can(principal, action, resource, ctx)` signature drift (HIGH).** If early call
   sites bake in RBAC-specific shapes (passing roles, not the resource+ctx), the ReBAC
   seam is lost and every call site must be rewritten later. Freeze the signature in M3.
5. **Event envelope / tenancy field omission (HIGH).** If the first events ship without
   `tenantId`, `version`, and `correlationId`, every consumer and every stored event
   needs migration once apps multiply. Get the envelope right before the first producer.
6. **Ambient tenant context adopted late (HIGH).** Every service that keeps hand-threading
   `orgId` is a future migration site and a leakage risk. Introduce ALS in M2 and forbid
   new manual scoping thereafter (lint rule).
7. **Legacy `User.orgId`/`role` removed too early (MEDIUM).** Dropping them before every
   reader is off `syncLegacyUserFields` breaks auth. Contract phase must be evidence-gated
   (grep-clean) — not scheduled.
8. **Engineering routes re-prefixed without redirects (MEDIUM).** Breaks bookmarks and
   any external links; add redirects if `/goals` → `/engineering/goals`.
9. **Registry manifest shape churn (MEDIUM).** If the manifest contract isn't stable
   before the 2nd app, both apps' manifests need rework. Stabilize with Engineering (M4)
   as the reference before Billing.
10. **Notifications/Audit built app-specific again (MEDIUM).** If Engineering's events and
    notifications aren't generalized in M6, the 2nd app re-implements them — the exact
    trap the platform exists to avoid.
11. **GrovynDashboard AI ported instead of rebuilt (LOW-MED).** Lifting the HuggingFace +
    JSON-repair code into the platform imports brittleness and bypasses the AI gateway's
    governance. Rebuild on Claude behind the gateway.

---

### Reviewer's verdict

Draft v1 is **sound and, if anything, conservative** about the repo's readiness. The
foundation (Membership-as-truth, live role resolution, org switching, R2 storage, design
system, clean guards) means **Horizon 1 is dominated by two greenfield builds — the PDP
and the Application Registry** — with the rest being disciplined refactoring. The
existential risks are all in the **data/tenancy/authz-freshness** layer and are
**front-loadable into M0–M3**, exactly where the milestone plan already puts them.
Proceed to milestone specs — starting with **M0 (RLS + multi-schema spike)**, which
gates everything below it.
