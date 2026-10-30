# Tasks: Issues (built-in, Linear-style tracker)

Replaces the previous plan, which bolted teams and sub-issues onto My Workspace. That work
was reverted: My Workspace is again a personal list (items on my plate + items I assigned to
others), and the Linear-style features live in their own **Issues** app.

## Product rules

- **Tracker per org.** An org that has connected Linear keeps **Task Updates** exactly as
  before. Every other org gets **Issues** in that sidebar slot. `GET /issues/mode` returns
  `linear | internal`; nav items carry `tracker: "linear" | "internal"` and the shell
  filters on it. Connecting or disconnecting Linear in Settings swaps the entry.
- **Visibility.** As in Linear's default: every org member can see and edit every team's
  issues. Team membership drives "my teams" and who can manage a team (LEADs plus
  OWNER/ADMIN).
- **My Workspace** shows a read-only "Issues assigned to you" card on My Board and an
  "Issues you assigned" card on Assigned by Me. Neither card appears for orgs on Linear.

## Data model (`20261030125311_issues_tracker`)

- [x] `Team` (reused) + `issueCounter` / `cycleCounter`; `TeamMember` (LEAD | MEMBER).
- [x] `Issue`: `${team.key}-${number}` identifier, status (Backlog, Todo, In Progress,
      In Review, Done, Canceled), priority (No priority, Urgent..Low), estimate, due date,
      assignee, creator, project, cycle, parent (sub-issues, any depth, loop-checked),
      labels, sortOrder, lifecycle timestamps, archive, soft delete.
- [x] `IssueLabel` (workspace-wide or team-scoped), `IssueComment`, `IssueActivity`.
- [x] `Project` (status, lead, start/target, teams, progress) and `Cycle` (per team,
      numbered, non-overlapping, complete with rollover).
- [x] Dropped `WorkspaceItem.teamId` / `parentId` (both were empty).

## API (`apps/api/src/engineering/issues`)

- [x] Teams CRUD + members, labels CRUD (default Bug/Feature/Improvement seeded with the
      first team).
- [x] Issues: list (filters: team, status, priority, assignee me/none/id, creator, project,
      cycle incl. `current`, label, parent, search incl. `ENG-42`, top-level only, active
      only, archived; ordered by priority/updated/created/due/manual), detail by id or
      identifier (with sub-issues, progress, activity), create, update (field-level
      activity, team move renumbers), archive/restore, delete (detaches children),
      `GET /issues/mine`.
- [x] Comments with @mentions; notifications for assignment, status change and comments.
- [x] Projects and cycles with progress (done / non-canceled scope).
- [x] Unit tests: issues, cycles, teams.

## Web (`apps/web/src/applications/engineering`)

- [x] `/issues`: views (My issues, Created by me, Active, Backlog, All), team filter,
      list grouped by status and a board (drag = status change), filters, `C` shortcut.
- [x] `/issues/[id]`: inline title/description, properties sidebar, sub-issues, activity +
      comments.
- [x] `/issues/projects`, `/issues/projects/[id]`, `/issues/cycles`, `/issues/cycles/[id]`.
- [x] `/issues/teams`: teams, members, labels.
- [x] My Workspace issues cards; tracker-aware sidebar.

## Later

- [ ] Seed demo issues in `seed-demo.ts`.
- [ ] Manual drag-reordering within a column (the API already accepts `sortOrder`).
- [ ] Custom workflow states per team, issue relations (blocks / duplicates), saved views.
- [ ] Optional: import Linear issues for orgs switching to the built-in tracker.
