# Global Tenant Switcher — Cross-Org Admin

**Status:** Implemented · **Date:** 2026-07-15 · **Branch:** `dev`

> Follows [05-APP-ACCESS-FIX-PLAN](./05-APP-ACCESS-FIX-PLAN.md). App Access could already target any org via an explicit `?orgId=`, but every *other* admin page (Users, Roles, Permissions, …) was hardwired to the operator's own org. This adds one **global** tenant switcher that rescopes the whole admin center.

## 1. Problem

In Platform Administration, a super-admin saw only their **own** org everywhere except App Access. The Users page literally said *"Manages users in the current organization only."* There was a `TenantSelector`, but it lived on the App Access page alone, held page-local state (reset on every navigation), and fed only the access matrix.

## 2. Design — one switcher, header-based scoping

A single switcher in the **shell header** (visible only under `/admin`) sets an acting tenant. That choice drives an `X-Org-Id` request header, and the backend rescopes the request to that org — so **every** org-scoped endpoint follows the switcher with no per-endpoint plumbing.

### Backend (one place)

`JwtStrategy.validate` (`apps/api/src/platform/auth/strategies/jwt.strategy.ts`) now reads the request (`passReqToCallback: true`) and, when an `X-Org-Id` header is present and differs from the token's org:

- **non-super-admin →** `403` (may never override);
- **super-admin, unknown org →** `403`;
- **super-admin, valid org →** `orgId` is rescoped to the target, the acting `role` is elevated to `OWNER` (a super-admin holds no membership there), and `homeOrgId` / `actingAsOrgId` are recorded.

Because every org-scoped controller already reads `user.orgId`, this covers Users, Roles, Permissions, App Access, etc. uniformly. The home-org membership check runs first and is unchanged, so a suspended/removed operator is still rejected before any override.

### Frontend

- **`shared/lib/api.ts`** — `setActingOrg(id?)` sets a module-global; every request attaches `X-Org-Id` **except** identity endpoints (`/auth`, `/platform/applications`, `/platform/organizations`, `/notifications`), so the operator's own launcher, nav, and unread counts stay pinned to their home org.
- **`platform/shell/admin-tenant.tsx`** — `AdminTenantProvider` is mounted **app-wide** (in `providers.tsx`) so it never remounts on navigation. It persists the selection to `localStorage`, and drives the override off the route: live only while under `/admin`, cleared on exit. On any scope change it `resetQueries` for org-scoped keys so admin screens refetch for the new tenant. `TenantSelector` renders in the shell header when `pathname` starts with `/admin`.
- The per-page selector was removed from `app-access-admin.tsx`; it now just reads `selectedOrgId` from the shared context.

## 3. Why a header (not `?orgId=` everywhere)

One change in the auth strategy scopes all current and future admin pages, versus threading a param + authorization check through every controller. The known trade-off of a blanket header — rescoping the operator's *own* identity/nav — is handled by the frontend identity-endpoint exclusion list, the standard pattern for "act as tenant" admin tooling.

## 4. Tests

`jwt.strategy.spec.ts` covers the boundary: no-header passthrough, self-org no-op, non-super-admin forbidden, unknown-org forbidden, super-admin rescope with elevated role, and inactive-membership rejection still firing first.
