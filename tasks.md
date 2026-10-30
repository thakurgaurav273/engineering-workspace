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
- [x] `Issue`: `${team.key}-${number}` identifier, status (the team's own workflow
      state, see below), priority (No priority, Urgent..Low), estimate, due date,
      assignee, creator, project, cycle, parent (sub-issues, any depth, loop-checked),
      labels, sortOrder, lifecycle timestamps, archive, soft delete.
- [x] `IssueLabel` (workspace-wide or team-scoped), `IssueComment`, `IssueActivity`.
- [x] `Project` (status, lead, start/target, teams, progress) and `Cycle` (per team,
      numbered, non-overlapping, complete with rollover).
- [x] Dropped `WorkspaceItem.teamId` / `parentId` (both were empty).
- [x] `IssueState` (`20261030132005_issue_workflow_states`): per-team statuses with a name,
      colour and fixed category (Backlog, Unstarted, Started, Completed, Canceled). The
      category drives lifecycle timestamps, progress and "open" filters. New teams get the
      default six; a team always keeps at least one Unstarted and one Completed status.

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

- [x] `shared/components/creatable-select.tsx`: API-backed searchable select that offers
      "Create <noun> "…"" when nothing matches, either directly (`create.action`) or through
      an extra step (`create.form`). Used for labels, statuses (asks for category + colour)
      and projects; reuse it for any other org-defined value.

- [x] `/issues`: views (My issues, Created by me, Active, Backlog, All), team filter,
      list grouped by status and a board (drag = status change), filters, `C` shortcut.
- [x] `/issues/[id]`: inline title/description, properties sidebar, sub-issues, activity +
      comments.
- [x] `/issues/projects`, `/issues/projects/[id]`, `/issues/cycles`, `/issues/cycles/[id]`.
- [x] `/issues/teams`: teams, members, workflow (statuses), labels.
- [x] My Workspace issues cards; tracker-aware sidebar.

## Later

- [ ] Seed demo issues in `seed-demo.ts`.
- [ ] Manual drag-reordering within a column (the API already accepts `sortOrder`).
- [ ] Issue relations (blocks / duplicates), saved views.
- [ ] Optional: import Linear issues for orgs switching to the built-in tracker.

---

# Tasks: Business document templates (PDF)

Modelled on OneHaul's admin PDF templates (HTML + placeholders, draft → publish → immutable
versions, browser and PDF previews, problems panel), adapted to our data: each document type
has a fixed variable tree built from our own records, so there is no per-template schema.

## Decisions

- Templates are org-owned (OWNER/ADMIN edit) plus platform starters (`orgId = null`,
  super admins only) that every org can copy. Built-in "Classic" starters live in code and are
  the fallback when an org has no published default.
- HTML/CSS code editor (CodeMirror) only; no visual block designer.
- Template language: LiquidJS (sandboxed: auto-escaped output, no includes, time/size limits).
  Custom formatters: `money`, `amount_in_words`, `number`, `percent`, `date_format`,
  `multiline`, `html` (rich text, active content stripped).
- Renderer: existing Puppeteer/Chromium, now with JavaScript off, assets only from allowed
  hosts (`PDF_ALLOWED_HOSTS` + upload stores + Google Fonts), timeouts, and an optional
  "Page X of Y" footer via `<meta name="page-numbers" content="bottom-right">` (Chromium
  ignores CSS @page margin boxes).
- Documents pin the template version they render with once they leave DRAFT
  (`templateVersionId`), so re-downloading an issued invoice is reproducible.

## Done

- [x] Models `DocumentTemplate` / `DocumentTemplateVersion` / `DocumentTemplateEvent`;
      `templateId` + `templateVersionId` on Invoice, Quotation, Proposal, OfferLetter
      (`20261030140000_document_templates`, additive).
- [x] API `business/document-templates`: catalog, starters, list, create (blank / built-in /
      copy), details, save draft (optimistic revision), discard, validate, preview (html/pdf,
      sample or a real document), publish (blocked on errors), rollback, default, archive,
      versions (+ version PDF), events. Permissions `document-template:read|write`.
- [x] Invoice / quotation / proposal / offer-letter preview, PDF and email use the org template
      (classic TS renderers kept only as a last-resort fallback).
- [x] Dockerfile installs Alpine Chromium + fonts and points Puppeteer at it (previously the
      container had no browser, so PDFs failed in production). Not yet verified with a build.
- [x] Error filter now forwards structured extras (`issues`, `currentRevision`) in `errors`;
      the web `ApiError` exposes them as `details`.
- [x] Web: Business → Templates list + editor (Design / Variables / Versions / Details).

## Next

- [ ] Pick a non-default template per document (columns exist; add to the edit forms).
- [ ] Payment receipts (RECEIPT type) on the same system.
- [ ] Image upload button in the editor (needs a `public_branding`-style upload type).
- [ ] Render log (count, failures, duration) like OneHaul's Overview, if needed.
