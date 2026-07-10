# Schema Compatibility Report — Production → New Prisma Schema

**Verdict: ✅ Compatible. 0 breaking changes. A data-only restore is the correct path (no ETL).**

## How this was verified (not assumed)

Every claim below was produced by executing against the restored production
database, not by reading code:

- **Source of truth — production:** the restored snapshot `grovyn_prod_snapshot`
  (22 business tables + `_prisma_migrations`), introspected via
  `information_schema`.
- **Target — new schema:** built in a throwaway database by applying the
  committed migration `apps/api/prisma/migrations/0_init/migration.sql`, then
  introspected the same way. It matches `schema.prisma` exactly — `prisma migrate
  diff --from-migrations --to-schema-datamodel` reports **"No difference
  detected."**
- **Comparison:** column-by-column (name, type, nullability, default), enum
  value sets, and primary keys, diffed programmatically.
- **Proof by execution:** a full `pg_dump --data-only` of production
  (excluding `_prisma_migrations`) was restored into the new schema. All 22
  tables loaded with **exact row-count parity**.

## Tables

All 22 production tables exist unchanged in the new schema (not renamed, merged,
or split):

`CheckIn`, `Goal`, `GoalHistory`, `Invitation`, `LinearIssue`, `Membership`,
`Notification`, `NotificationPreference`, `Organization`, `OrganizationSettings`,
`OrganizationSwitchLog`, `PushDevice`, `Recognition`, `Session`, `TaskUpdate`,
`TaskUpdateAttachment`, `User`, `UserPreference`, `WeeklyReview`, `WorkspaceItem`,
`WorkspaceItemComment`, `WorkspaceItemCommentAttachment`.

### Added tables (20 — all new, all start empty)

`ApplicationConfiguration`, `ApplicationInstallation`, `AuthzRole`, `Client`,
`CompanyProfile`, `DocumentNumberSequence`, `Invoice`, `InvoiceLine`,
`OfferLetter`, `OfferLetterTemplate`, `Payment`, `Permission`,
`PlatformRoleAssignment`, `Proposal`, `ProposalSection`, `Quotation`,
`QuotationLine`, `RolePermission`, `TaxConfig`, `UserRoleAssignment`.

The new schema totals **42 tables, 31 enums, 66 foreign keys, 122 indexes**.

## Shared-table column changes

The only difference across all 22 shared tables:

### Added nullable columns
- `User.signatureUrl` — `TEXT NULL`. Absent from prod, nullable in the new
  schema, so a data-only `COPY` that omits it is valid.

### Added required columns with defaults
- None on any shared table.

### Added required columns **without** default (would break a restore)
- **None.** This is the check that matters for a data-only load, and it is clean.

## Enums

All 17 shared enums are **identical** in value set (`CheckInStatus`, `GoalStatus`,
`GoalVisibility`, `InvitationStatus`, `LinearWorkflowType`, `MembershipStatus`,
`NotificationPlatform`, `NotificationType`, `ReviewStatus`, `ReviewType`, `Role`,
`TaskUpdateAttachmentKind`, `TaskUpdateStatus`, `WorkspacePriority`,
`WorkspaceReminderStage`, `WorkspaceSource`, `WorkspaceStatus`).

- **Removed enum values:** none.
- **Changed enum values:** none (`NotificationType` is declared in a different
  order but the value *set* is identical; order does not affect stored data).
- **Added enums:** 14, all belonging to the new tables.

## Primary keys

Every shared table's primary key is unchanged — `id` (`text`, cuid) in both
production and the new schema. **0 primary-key changes.**

## Breaking-change checklist

| Check | Result |
| ----- | ------ |
| Renamed tables | None |
| Renamed columns | None |
| Dropped columns | None |
| Changed data types | None |
| Changed primary keys | None |
| Changed foreign keys (on existing tables) | None |
| Nullable → required (on existing columns) | None |
| Added required column without default (existing table) | None |
| Removed enums | None |
| Removed/changed enum values | None |

## Conclusion

The new schema is a strict **superset** of production. No transform/ETL step is
warranted or needed. The correct migration is:

> production data → new schema (via Prisma migrations) → **data-only** restore → done.

See `docs/DEPLOY-STAGING.md` for the exact, scripted procedure.
