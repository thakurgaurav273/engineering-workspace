# App Access & Multi-Org Permissions — Fix Plan

**Status:** Implemented · **Date:** 2026-07-14 · **Branch:** `dev`
**Owner decision (captured):** auto-grant installed apps on join · org OWNER/ADMIN + super-admin manage access · plan-first.

> **Implemented:** backend (auto-grant + delegated authz + backfill) and frontend (shared `AppAccessMatrix` surfaced in both Platform Administration and Organization Settings). See §4.4 and the delivery notes at the bottom.

---

## 1. Problem

Members invited into any organization other than the primary Grovyn org log in and see **only the Settings tab** — Engineering and Business Operations are missing. Org admins of those other orgs cannot fix it themselves.

This is **not** because Engineering/Business Operations are "platform-owned." They are ordinary installable apps and they *are* installed in every org. The failure is in the **per-user access layer**.

## 2. Root cause

App visibility passes through three layers, in order, in `RegistryController.list` (`apps/api/src/kernel/registry/registry.controller.ts:24`):

| # | Layer | Code | Verdict |
|---|-------|------|---------|
| 1 | Registry — hides `requiresSuperAdmin` apps | `registry.listVisible()` | ✅ fine. Only `platform-admin` is super-admin-only; Engineering/Business-Ops are not. |
| 2 | Per-org installation state | `installation.applyInstallationState()` | ✅ fine. Bootstrap installs every installable app `INSTALLED` for **every** org (`installation-bootstrap.service.ts:30`). Screenshot confirms "5 orgs installed." |
| 3 | **Per-user grant** | `appAccess.filterByUserAccess()` (`app-access.service.ts:35`) | ❌ **the failure.** Deny-by-default: a member sees an installable app **only if** a `UserApplicationAccess` row with `granted=true` exists for them in that org. |

Two coupled defects:

1. **No default grant exists.** The only writer of `UserApplicationAccess` is `AppAccessService.setAccess` (verified by grepping every write). Invitation-accept and org-signup create a `Membership` but **zero** grant rows. So every fresh member has an empty grant set → layer 3 strips Engineering + Business Operations → the only survivor is the `core` app (`showInLauncher: false`, ungated chrome), which renders as **Settings**. Exactly the reported symptom.

2. **Only a platform super-admin can grant.** `PUT /platform/app-access` is hard-gated to `PLATFORM_SUPER_ADMINS` (`app-access.controller.ts:68`). Org OWNER/ADMIN of proton, Rentrik, Grovyn Growth cannot grant access to their own members. App access is a *platform* control, not an *org* capability.

The primary-org owner (Gaurav) is a super-admin, so he bypasses all three layers and never sees the wall. Every other org hits it. (Note: `OWNER` is per-`Membership`, so "one user owns one workspace" is not the problem — a user can own one org and be a member of others.)

## 3. Goals

- A member who joins an org can immediately use every app installed in that org.
- Each org is self-sufficient: its OWNER/ADMIN manages per-user app access; platform super-admin remains an override.
- Deny-by-default semantics are preserved for explicit revocation.
- No behavior change for the existing super-admin path.

## 4. Design

### 4.1 Auto-grant on membership activation

Introduce `AppAccessService.grantDefaultAccess(orgId, userId, tx?)`: for every **installable** app currently **installed/enabled** in `orgId` (reuse `installation.applyInstallationState` over `installation.installableApps()`), upsert a `UserApplicationAccess` row with `granted=true`. Idempotent; never downgrades an existing explicit `granted=false` (respect prior revocations — only create missing rows, do not flip existing ones).

Call it at all three membership-activation points, inside the existing transaction where present:

| Point | Location | Membership |
|-------|----------|------------|
| Signup creates org | `apps/api/src/platform/auth/auth.service.ts:64-87` | OWNER, ACTIVE |
| Existing user accepts invite | `apps/api/src/platform/invitations/invitations.service.ts:178-180` | → ACTIVE |
| New user registers via invite | `apps/api/src/platform/invitations/invitations.service.ts:218-223` | ACTIVE |

Because the grant helper accepts a Prisma `tx`, it composes with the existing `$transaction` blocks (activation + grant commit atomically).

### 4.2 Backfill existing members

One-off idempotent backfill (a script `apps/api/prisma/scripts/backfill-app-access.ts`, or a guarded method invoked once) that, for every `ACTIVE` membership with no grant row for an installed app, creates `granted=true`. This unblocks the members already stuck today (proton, Rentrik, Growth). Idempotent and safe to re-run; respects existing explicit `granted=false`.

### 4.3 Delegate management to org admins

Widen who may read the access matrix and set grants **for their own org**, keeping super-admin as a cross-org override.

- **New authorization rule** in `AppAccessController` (`app-access.controller.ts`): allow the call when the caller is a super-admin **or** an OWNER/ADMIN **of the target org**. Replace the blanket `requireSuperAdmin` with `requireOrgManagerOrSuperAdmin(user, orgId)`:
  - super-admin → allow any `orgId`.
  - otherwise → the resolved `orgId` **must equal the caller's active org** *and* the caller's membership role in that org must be `OWNER` or `ADMIN`. A non-super-admin may never target another org's `orgId` via the DTO.
- The existing `@RequirePermission('platform:user:manage')` shadow annotation stays for audit parity; the runtime decision is the explicit check above (mirrors how the controller already works).
- Keep the `AuditService.record` call — it already captures actor + org, which now matters more with multiple grantors.

### 4.4 Frontend — DONE

The matrix table + hooks were extracted into one shared component, `apps/web/src/shared/components/app-access-matrix.tsx` (`AppAccessMatrix`), which owns the data query, the toggle mutation (now optimistic), and its loading/error/empty states. Two thin callers render it:

- **Platform Administration** — `app-access-admin.tsx` wraps it with the `TenantSelector`, passing `orgId={selectedOrgId}` (super-admin, any org). Behaviour unchanged.
- **Organization Settings** — a new "App Access" section in `settings.tsx` (`AppAccessSection`) renders `<AppAccessMatrix />` with **no** `orgId`, so the backend scopes to the caller's own active org. No tenant selector; org OWNER/ADMIN cannot switch or target another org.

The section is gated to OWNER/ADMIN in the settings nav *and* by a render guard, and the API independently rejects a non-super-admin targeting another org (`authorizeOrg`). Members never see it. Added UX: searchable member list, per-app icons, optimistic switch with rollback, success/error toasts, and explicit loading/error/empty states.

## 5. Files to change

- `apps/api/src/kernel/app-access/app-access.service.ts` — add `grantDefaultAccess(orgId, userId, tx?)`; only-create-missing semantics.
- `apps/api/src/platform/auth/auth.service.ts` — call grant helper after OWNER membership create (signup).
- `apps/api/src/platform/invitations/invitations.service.ts` — call grant helper at both accept paths (lines ~178 and ~218).
- `apps/api/src/kernel/app-access/app-access.controller.ts` — `requireOrgManagerOrSuperAdmin`; inject membership lookup (or reuse request context role).
- `apps/api/src/kernel/app-access/app-access.service.spec.ts` — extend for grant-default + only-create-missing.
- `apps/api/prisma/scripts/backfill-app-access.ts` — one-off backfill (new).
- `apps/web/src/applications/platform/components/app-access-admin.tsx` (+ Settings surface) — expose to org managers (follow-up).

No schema/migration change — `UserApplicationAccess` already models everything needed.

## 6. Edge cases & decisions

- **Respect prior revocations.** Auto-grant creates *missing* rows only; it must not flip an existing `granted=false` back to `true`.
- **Apps installed after a member joined.** Auto-grant fires on join, not on install. Installing a new app in an org will not retroactively grant existing members. Decision needed later: either grant-on-install for all active members, or leave it to admins. Out of scope for this fix; note it, don't silently assume coverage.
- **Non-super-admin cannot escape their org.** The controller must reject any DTO `orgId` that isn't the caller's own org unless super-admin — otherwise delegation becomes a cross-org privilege escalation.
- **`platform-admin` stays super-admin-only.** It is `requiresSuperAdmin` and never installable, so it is untouched by any of this.

## 7. Verification

1. Auto-grant unit tests (all three activation points; idempotency; revocation-respected).
2. Manual: invite a fresh user into `@proton` → on first login they see Engineering + Business Operations, not just Settings.
3. Manual: as OWNER of `@Rentrik` (non-super-admin), grant/revoke an app for a member and confirm it takes effect; confirm the same user cannot target another org's `orgId`.
4. Run backfill on a copy of prod data; confirm existing stuck members gain access and re-running is a no-op.
5. Confirm super-admin behavior is unchanged.

## 8. Rollout

1. Ship API (auto-grant + delegated management) behind normal deploy.
2. Run the backfill once.
3. Ship the frontend surface for org-admin management.
4. Spot-check each non-primary org.
