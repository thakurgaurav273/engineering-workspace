# Engineering Backlog

Tracks scoped-out or deferred work. Not a roadmap — just what was consciously left out of
a shipped feature and why, so it isn't rediscovered from scratch later.

## My Workspace (shipped 2026-07-05)

Personal action-item/Kanban feature. See `ENGINEERING.md` → "My Workspace" for the shipped
API. Deferred:

- **Markdown rendering** — `description` is stored and sent as raw markdown, but the
  frontend renders it as plain text (no `react-markdown`/sanitized HTML pipeline yet).
  Low risk today since it's private-by-default text, but worth revisiting before treating
  it as trusted rich content anywhere.
- **In-column reordering** — drag & drop currently only moves cards between status
  columns; within a column, order is fixed by due date then recency. A manual `sortOrder`
  column would be needed for user-defined ordering.
- **Priority-aware sort at the DB layer** — `GET /workspace?sortBy=priority` sorts
  alphabetically by the Postgres enum (`HIGH, LOW, MEDIUM, URGENT`), not by severity. The
  frontend board view re-sorts client-side correctly; the raw list endpoint doesn't.
  Fixable with a raw `ORDER BY CASE priority ...` if the list endpoint ever needs it.
- **Archived-item actions** — the archive viewer (Sheet on `/workspace`) is read-only;
  there's no "unarchive" or permanent-delete action from that view yet.
- **Bulk operations** — no multi-select bulk status change / bulk delete, unlike
  Administration's data-management bulk-delete pattern.
- **Linear-originated items** — `WorkspaceSource.LINEAR` exists in the enum for tagging,
  but nothing currently auto-creates a `WorkspaceItem` from a Linear issue. If that's ever
  wanted, keep it one-directional (Linear → a workspace reminder) — never sync workspace
  edits back into Linear, or this stops being "not Linear."
