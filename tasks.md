# Tasks: End-to-End Task Management Workspace

Status verified against the codebase: nothing below is implemented yet
(`Team`/`TeamMember` models, `WorkspaceItem.teamId` and `team.service.ts` do not exist).

## Phase 1: Database Schema & Core Models

- [x] Add `Team` model to Prisma schema.
- [x] Add `TeamMember` relationship model (links `User` to `Team`).
- [x] Extend `WorkspaceItem` to support `teamId` assignment.
- [x] Add sub-issue support to `WorkspaceItem`: nullable `parentId`, self-relation `parent`/`children`, `@@index([parentId])`.
- [ ] Add `Board` or `Workflow` configuration models for task lifecycle management.
- [x] Create Prisma migration (`20261030120000_teams_and_sub_items`, additive only).
- [x] Verified the migration on a throwaway real Postgres 18: the full history applies cleanly, `prisma migrate diff` shows zero drift vs `schema.prisma`, FK rules are as designed, and a smoke script exercised the real query shapes (filtered child `_count`, `topLevelOnly`, unique team key, member upsert, parent detach, team delete). Scratch DB deleted.
- [ ] Apply migration to YOUR database (`npx prisma migrate deploy` in `apps/api`) - not done by me.

## Phase 2: Backend API Refinement (Workspace Module)

- [x] Implement `TeamService` for CRUD operations on teams (+ `create-team.dto.ts`, `TeamController` at `workspace/teams`, registered in `workspace.module.ts`).
- [x] Update `WorkspaceService` to handle task assignment logic (User vs. Team): `teamId` validated against org, archived state and caller membership.
- [x] Add optional `parentId` to create/update item DTOs.
- [x] Sub-issue validation: parent in same org, not deleted, accessible to caller, no cycles, max nesting depth of one level.
- [x] Add `GET /workspace/:id/sub-items` and return `subItems` + `subItemProgress` (done/total) on item detail.
- [x] Add `topLevelOnly` filter (and `teamId` filter on list) to list/board queries to hide sub-items from top-level views.
- [x] Parent/child lifecycle rules: deleting a parent detaches its children.
- [ ] Optionally prompt to complete parent when all children are done.
- [ ] Add API endpoints for task lifecycle transitions.
- [x] Unit tests for sub-issue validation and team assignment logic (in `workspace.service.spec.ts`).
- [x] Unit tests for `TeamService` (`team.service.spec.ts`).
- [x] Fix the 3 pre-existing failing `delegate` tests: mocks lacked `status: ACTIVE`, and one test asserted a direct-reports restriction that the service (and web UI) deliberately don't have - rewritten to assert the documented behaviour.

## Phase 3: Frontend Workspace Module

- [ ] Create workspace dashboard UI.
- [ ] Implement team management interface.
- [ ] Implement board/list views for task tracking.
- [x] Typed API layer: `parentId`/`teamId`/sub-item types, `workspaceApi.subItems`, `teamsApi`.
- [x] Sub-issue UI on item detail: child checklist, inline "Add sub-issue", progress bar (`sub-items-section.tsx`).
- [x] Show parent breadcrumb on sub-issues, team badge on detail, and team/parent/sub-issue-count badges on board cards and list rows.
- [x] Team hooks (`use-teams.ts`) and team picker in the create/edit dialog (edit only sends `teamId` when changed).
- [x] Team management interface: `/workspace/teams` page with team list, create dialog (admin), member add/remove, lead roles, archive; linked from My Workspace header.
- [x] "Hide sub-issues" toggle (`topLevelOnly`) in the My Workspace filter row - applies to both the board and the Assigned list.
- [x] ~~Collapse/expand children in list view~~ - dropped: the page is a flat board + "Assigned" list with no nested rows, so there is nothing to collapse. Sub-issues are tagged with their parent and the toggle hides them; children are managed on the parent's detail page.

## Phase 4: Integration & UX Polish

- [x] Ensure backward compatibility with Linear sync: verified - the sync only reads/writes `LinearIssue` and never touches `WorkspaceItem`, so the new `parentId`/`teamId` columns can't affect it. Full API suite: 320/321 pass (the one failure is a pre-existing `recognition.service.spec` mock gap, unrelated).
- [ ] (Re-scoped, needs a decision) Linear `parent` mapping: the sync does not create workspace items, so there is nothing to map `parentId` onto. If Linear sub-issues should show up, add `parent { id }` to the GraphQL query and a `parentLinearId` to `LinearIssue` instead.
- [ ] (Pre-existing, unrelated) Fix `recognition.service.spec.ts`: prisma mock lacks `userPreference`.
- [x] Add permission checks for team-based task visibility: team members get read-only access (item detail, sub-items, comments, `GET /workspace/teams/:id/items`); admins see any team's items; edit/move/comment/delete/delegate stay with owner/assigner/admins. Team items card on `/workspace/teams`.
