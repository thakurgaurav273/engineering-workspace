import {
  EmploymentType,
  GoalVisibility,
  LinearWorkflowType,
  PaymentMethod,
  Role,
  TaskUpdateStatus,
  WorkspacePriority,
  WorkspaceSource,
  WorkspaceStatus,
} from '@prisma/client';

/**
 * Content for the demo tenant (see ../seed-demo.ts): a fictional 13-person software company.
 * People are referenced by `key`; day offsets are relative to the day the seed runs, so the
 * data always looks current. In comment bodies, `{@key}` becomes a real @mention of that person.
 */

export const ENGINEERING_APP = 'engineering';
export const BUSINESS_APP = 'business-operations';

export const ORG = {
  name: 'Nimbus Labs',
  description: 'Product engineering studio building SaaS for retail, logistics and healthcare teams.',
};

/** Domain for every seeded address. `.example` is reserved (RFC 2606), so nothing is ever delivered. */
export const EMAIL_DOMAIN = 'nimbuslabs.example';

export interface DemoPerson {
  key: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  role: Role;
  manager: string | null;
  apps: string[];
  joinedDaysAgo: number;
  /** Posts daily check-ins and weekly self reviews. */
  engineering: boolean;
}

const BOTH = [ENGINEERING_APP, BUSINESS_APP];
const ENG = [ENGINEERING_APP];

/** `demo` is the account recruiters sign in with. */
export const PEOPLE: DemoPerson[] = [
  { key: 'rohan', firstName: 'Rohan', lastName: 'Mehta', jobTitle: 'CEO & Co-founder', department: 'Leadership', role: 'OWNER', manager: null, apps: BOTH, joinedDaysAgo: 720, engineering: false },
  { key: 'demo', firstName: 'Aditi', lastName: 'Rao', jobTitle: 'Head of Engineering', department: 'Engineering', role: 'ADMIN', manager: 'rohan', apps: BOTH, joinedDaysAgo: 610, engineering: true },
  { key: 'farhan', firstName: 'Farhan', lastName: 'Qureshi', jobTitle: 'Finance & Operations Lead', department: 'Operations', role: 'ADMIN', manager: 'rohan', apps: BOTH, joinedDaysAgo: 540, engineering: false },
  { key: 'karan', firstName: 'Karan', lastName: 'Malhotra', jobTitle: 'Engineering Manager, Platform', department: 'Platform', role: 'MEMBER', manager: 'demo', apps: ENG, joinedDaysAgo: 500, engineering: true },
  { key: 'sneha', firstName: 'Sneha', lastName: 'Iyer', jobTitle: 'Engineering Manager, Product', department: 'Product Engineering', role: 'MEMBER', manager: 'demo', apps: ENG, joinedDaysAgo: 470, engineering: true },
  { key: 'vikram', firstName: 'Vikram', lastName: 'Singh', jobTitle: 'Senior Backend Engineer', department: 'Platform', role: 'MEMBER', manager: 'karan', apps: ENG, joinedDaysAgo: 430, engineering: true },
  { key: 'neha', firstName: 'Neha', lastName: 'Gupta', jobTitle: 'Backend Engineer', department: 'Platform', role: 'MEMBER', manager: 'karan', apps: ENG, joinedDaysAgo: 260, engineering: true },
  { key: 'arjun', firstName: 'Arjun', lastName: 'Reddy', jobTitle: 'DevOps Engineer', department: 'Platform', role: 'MEMBER', manager: 'karan', apps: ENG, joinedDaysAgo: 330, engineering: true },
  { key: 'meera', firstName: 'Meera', lastName: 'Pillai', jobTitle: 'Senior Frontend Engineer', department: 'Product Engineering', role: 'MEMBER', manager: 'sneha', apps: ENG, joinedDaysAgo: 410, engineering: true },
  { key: 'rahul', firstName: 'Rahul', lastName: 'Desai', jobTitle: 'Full-stack Engineer', department: 'Product Engineering', role: 'MEMBER', manager: 'sneha', apps: ENG, joinedDaysAgo: 300, engineering: true },
  { key: 'ananya', firstName: 'Ananya', lastName: 'Sharma', jobTitle: 'Frontend Engineer', department: 'Product Engineering', role: 'MEMBER', manager: 'sneha', apps: ENG, joinedDaysAgo: 190, engineering: true },
  { key: 'kabir', firstName: 'Kabir', lastName: 'Joshi', jobTitle: 'QA Engineer', department: 'Product Engineering', role: 'MEMBER', manager: 'sneha', apps: ENG, joinedDaysAgo: 240, engineering: true },
  { key: 'tanvi', firstName: 'Tanvi', lastName: 'Bhatt', jobTitle: 'Product Designer', department: 'Design', role: 'MEMBER', manager: 'sneha', apps: ENG, joinedDaysAgo: 280, engineering: true },
];

// ---- Daily check-ins: picked per department ------------------------------------------------

export const CHECK_IN_SUMMARIES: Record<string, string[]> = {
  Platform: [
    'Moved invoice PDF rendering onto the job queue; API p95 for exports dropped from 1.8s to 240ms.',
    'Paired with Neha on payment webhook retries - added idempotency keys and a dead-letter queue.',
    'Rolled out PgBouncer to staging. Connection errors gone under the 2k rps load test.',
    'Wrote the runbook for rotating production database credentials.',
    'Reviewed 4 PRs and merged the audit-log pagination fix.',
    'Upgraded all services to Node 22 LTS; CI is green.',
    'Traced the API memory spike to an unbounded LRU cache and capped it.',
    'Added Grafana alerts for queue depth and failed jobs.',
    'Migrated the reminder cron jobs to the new scheduler module.',
    'Load-tested check-in endpoints at 2k rps - no regressions.',
    'Cleaned up 40 stale feature flags and their dead code paths.',
    'Set up preview environments per PR on Dokploy.',
  ],
  'Product Engineering': [
    'Shipped invoice list filters behind a feature flag.',
    'Built the client portal invoice download page; waiting on design review.',
    "Fixed the date-picker timezone bug Acme Retail reported.",
    'Polished empty states across the workspace board.',
    'Wrote Playwright tests for the quotation flow.',
    'Synced with Tanvi on the onboarding v2 handoff and split it into 5 tickets.',
    'Refactored editor mentions - the bundle is 30% smaller.',
    'Triaged 6 bugs from the release 2.13 regression pass.',
    'Implemented keyboard shortcuts for the command palette.',
    'Accessibility pass on dialogs: focus traps and aria labels.',
    'Added optimistic updates to the goals page.',
    'Profiled the dashboard render - memoized the chart data, 60fps again.',
  ],
  Design: [
    'Finished hi-fi screens for onboarding v2.',
    'Ran 3 usability sessions on the new invoice editor.',
    'Updated the design tokens for dark mode contrast.',
    'Prototyped the client portal navigation in Figma.',
    'Design QA on the checkout revamp - filed 7 polish tickets.',
    'Synthesized customer interview notes into 4 themes.',
  ],
  Engineering: [
    'Ran sprint planning with both teams; committed to 58 points.',
    'Skip-level 1:1s with Vikram and Meera.',
    'Reviewed the hiring pipeline - 3 candidates in the final round.',
    'Published the postmortem for last week\'s API outage.',
    'Aligned with Sneha on Q4 roadmap trade-offs.',
    'Drafted the engineering career ladder v1 for feedback.',
    'Reviewed cloud spend with Arjun and Farhan.',
    'Architecture review for the client portal.',
  ],
};

export const CHECK_IN_BLOCKERS = [
  'Waiting on staging database credentials from DevOps.',
  'Blocked on design sign-off for the checkout screens.',
  'Flaky e2e test on CI is blocking the merge.',
  'Need a product decision on GST rounding for credit notes.',
  "Third-party SMS provider's sandbox is down.",
  'Waiting on Acme Retail for API access to their ERP.',
];

// ---- Goals --------------------------------------------------------------------------------

export interface DemoGoal {
  owner: string;
  title: string;
  description: string;
  visibility: GoalVisibility;
  assignedBy?: string;
  progress: number;
  createdDaysAgo: number;
  dueInDays: number;
  completedDaysAgo?: number;
}

export const GOALS: DemoGoal[] = [
  { owner: 'demo', title: 'Roll out weekly reviews across engineering', description: 'Every engineer submits a self review and gets manager feedback each week.', visibility: 'team', assignedBy: 'rohan', progress: 75, createdDaysAgo: 60, dueInDays: 45 },
  { owner: 'demo', title: 'Define the engineering career ladder', description: 'Levels, expectations and promotion process for IC and manager tracks.', visibility: 'personal', progress: 40, createdDaysAgo: 40, dueInDays: 60 },
  { owner: 'demo', title: 'Cut incident MTTR below 30 minutes', description: 'Better alerting, runbooks and on-call drills.', visibility: 'team', progress: 55, createdDaysAgo: 50, dueInDays: 30 },
  { owner: 'karan', title: 'Hire 2 backend engineers', description: 'Close two senior backend roles for the Platform team.', visibility: 'team', assignedBy: 'demo', progress: 50, createdDaysAgo: 55, dueInDays: 40 },
  { owner: 'karan', title: 'Platform uptime at 99.95%', description: 'Measured monthly across API and workers.', visibility: 'team', assignedBy: 'demo', progress: 90, createdDaysAgo: 80, dueInDays: 20 },
  { owner: 'sneha', title: 'Deliver the Q4 product roadmap', description: 'Client portal, onboarding v2 and invoice automation.', visibility: 'team', assignedBy: 'demo', progress: 60, createdDaysAgo: 70, dueInDays: 50 },
  { owner: 'sneha', title: 'Mentor Ananya to an independent feature owner', description: 'Weekly pairing and owning one feature end to end.', visibility: 'personal', progress: 65, createdDaysAgo: 45, dueInDays: 60 },
  { owner: 'vikram', title: 'Cut API p95 latency below 200ms', description: 'Focus on export, dashboard and search endpoints.', visibility: 'team', assignedBy: 'karan', progress: 70, createdDaysAgo: 50, dueInDays: 25 },
  { owner: 'vikram', title: 'Move background jobs to a durable queue', description: 'Replace in-process cron with a persistent job queue.', visibility: 'personal', progress: 100, createdDaysAgo: 75, dueInDays: -10, completedDaysAgo: 12 },
  { owner: 'neha', title: 'Ship invoice PDF generation v2', description: 'Faster rendering, custom sections and better fonts.', visibility: 'team', assignedBy: 'karan', progress: 45, createdDaysAgo: 30, dueInDays: 21 },
  { owner: 'neha', title: 'Integration tests for payments', description: 'Cover partial payments, overpayment guards and refunds.', visibility: 'personal', progress: 80, createdDaysAgo: 35, dueInDays: 10 },
  { owner: 'arjun', title: 'Zero-downtime deployments', description: 'Blue/green deploys for the API and web apps.', visibility: 'team', assignedBy: 'karan', progress: 100, createdDaysAgo: 65, dueInDays: -15, completedDaysAgo: 18 },
  { owner: 'arjun', title: 'Reduce cloud spend by 15%', description: 'Rightsize instances and add reserved capacity.', visibility: 'team', assignedBy: 'demo', progress: 60, createdDaysAgo: 40, dueInDays: 35 },
  { owner: 'meera', title: 'Launch design system tokens v2', description: 'Semantic color tokens with full dark-mode support.', visibility: 'team', assignedBy: 'sneha', progress: 85, createdDaysAgo: 45, dueInDays: 12 },
  { owner: 'meera', title: 'Lighthouse score 95+ on key pages', description: 'Dashboard, invoices and workspace.', visibility: 'personal', progress: 50, createdDaysAgo: 25, dueInDays: 30 },
  { owner: 'rahul', title: 'Client portal MVP', description: 'Clients can view and download invoices and quotations.', visibility: 'team', assignedBy: 'sneha', progress: 35, createdDaysAgo: 28, dueInDays: 42 },
  { owner: 'rahul', title: 'Learn Rust fundamentals', description: 'Finish the Rust book and build a small CLI.', visibility: 'personal', progress: 20, createdDaysAgo: 20, dueInDays: 70 },
  { owner: 'ananya', title: 'WCAG AA accessibility fixes', description: 'Close every issue from the accessibility audit.', visibility: 'team', assignedBy: 'sneha', progress: 65, createdDaysAgo: 33, dueInDays: 18 },
  { owner: 'kabir', title: 'Automate the regression suite with Playwright', description: 'Replace the manual release checklist.', visibility: 'team', assignedBy: 'sneha', progress: 55, createdDaysAgo: 38, dueInDays: 26 },
  { owner: 'tanvi', title: 'Redesign the onboarding flow', description: 'Fewer steps, clearer value in the first session.', visibility: 'team', assignedBy: 'sneha', progress: 100, createdDaysAgo: 55, dueInDays: -5, completedDaysAgo: 8 },
  { owner: 'tanvi', title: 'Interview 10 customers', description: 'Understand invoicing pain points for the next quarter.', visibility: 'personal', progress: 70, createdDaysAgo: 30, dueInDays: 20 },
  { owner: 'rohan', title: 'Close 3 enterprise deals this quarter', description: 'Retail and logistics segments.', visibility: 'personal', progress: 66, createdDaysAgo: 60, dueInDays: 40 },
  { owner: 'farhan', title: 'Automate monthly GST reconciliation', description: 'Match invoices and payments against GSTR filings.', visibility: 'personal', progress: 30, createdDaysAgo: 25, dueInDays: 45 },
];

export const GOAL_NOTES = [
  'Kickoff - scoped the work.',
  'First milestone done.',
  'Good progress this week.',
  'Unblocked after the design review.',
  'Halfway there.',
  'Nearly done - final polish.',
  'Done!',
];

// ---- Weekly reviews -----------------------------------------------------------------------

export const REVIEW_WINS = [
  'Shipped everything committed in sprint planning.',
  'Closed the long-standing export timeout bug.',
  'Mentored a teammate through their first production deploy.',
  'Got positive feedback from Acme Retail on the new filters.',
  'Cut CI time from 14 to 6 minutes.',
  'Led the incident response calmly and documented it well.',
];
export const REVIEW_CHALLENGES = [
  'Too many context switches between support and feature work.',
  'Requirements for the client portal kept shifting mid-sprint.',
  'Flaky tests slowed down merges.',
  'Underestimated the migration effort.',
  'Juggling interviews with delivery work.',
];
export const REVIEW_LEARNINGS = [
  'Breaking work into smaller PRs made reviews much faster.',
  'Learned how Postgres plans queries with partial indexes.',
  'Writing the design doc first saved a week of rework.',
  'Pairing early on unclear tickets pays off.',
  'Feature flags make risky launches calm.',
];
export const REVIEW_FEEDBACK = [
  'Great ownership this week - keep raising risks early like you did on Tuesday.',
  'Strong delivery. Next step: involve the team earlier in design decisions.',
  'Solid week. Try to timebox support work so feature work does not slip.',
  'Excellent collaboration with design - the handoff was the smoothest yet.',
  'Good progress. Let us pair on estimation for the next sprint.',
];

// ---- Recognition --------------------------------------------------------------------------

export interface DemoRecognition {
  from: string;
  to: string;
  title: string;
  note: string;
  daysAgo: number;
}

export const RECOGNITIONS: DemoRecognition[] = [
  { from: 'karan', to: 'demo', title: 'Calm, clear incident leadership', note: 'You kept the outage war room focused and the status page updated. The postmortem was a masterclass.', daysAgo: 1 },
  { from: 'demo', to: 'vikram', title: 'Crushed API latency', note: 'p95 down 45% on exports. Customers noticed.', daysAgo: 2 },
  { from: 'sneha', to: 'meera', title: 'Design system hero', note: 'The new tokens made dark mode a one-day job instead of a sprint.', daysAgo: 3 },
  { from: 'rohan', to: 'demo', title: 'Hiring pipeline turnaround', note: 'Three strong finalists in two weeks. Huge.', daysAgo: 5 },
  { from: 'vikram', to: 'neha', title: 'Bulletproof payment retries', note: 'Idempotency keys plus the DLQ saved us during the gateway blip.', daysAgo: 6 },
  { from: 'meera', to: 'ananya', title: 'Accessibility champion', note: 'Focus traps fixed everywhere. Screen reader users will thank you.', daysAgo: 7 },
  { from: 'kabir', to: 'rahul', title: 'Fastest bug turnaround', note: 'Fixed and shipped the timezone bug within an hour of my report.', daysAgo: 9 },
  { from: 'arjun', to: 'karan', title: 'Great on-call rotation design', note: 'Fair, documented and the pager is quiet now.', daysAgo: 10 },
  { from: 'demo', to: 'tanvi', title: 'Onboarding redesign shipped', note: 'Activation is up 18% in the first week. Beautiful work.', daysAgo: 12 },
  { from: 'farhan', to: 'neha', title: 'GST rounding fix', note: 'Credit notes finally reconcile to the paisa.', daysAgo: 13 },
  { from: 'rahul', to: 'kabir', title: 'Caught a release blocker', note: 'Your regression pass found the quotation total bug before customers did.', daysAgo: 15 },
  { from: 'demo', to: 'arjun', title: 'Zero-downtime deploys', note: 'We deployed 9 times last week and nobody noticed. That is the goal.', daysAgo: 17 },
  { from: 'sneha', to: 'tanvi', title: 'Customer interviews', note: 'Your synthesis changed our Q4 priorities for the better.', daysAgo: 19 },
  { from: 'neha', to: 'vikram', title: 'Patient mentor', note: 'Thanks for walking me through the queue internals.', daysAgo: 21 },
  { from: 'ananya', to: 'meera', title: 'Thoughtful code reviews', note: 'Every review teaches me something.', daysAgo: 23 },
  { from: 'karan', to: 'arjun', title: 'Cost savings', note: 'Rightsizing saved 11% on our cloud bill this month.', daysAgo: 25 },
  { from: 'rohan', to: 'sneha', title: 'Client demo was flawless', note: 'Orbit Logistics signed the next phase after your demo.', daysAgo: 28 },
  { from: 'vikram', to: 'demo', title: 'Shielded the team', note: 'Thanks for pushing back on the scope creep so we could ship.', daysAgo: 31 },
  { from: 'meera', to: 'rahul', title: 'Portal prototype in record time', note: 'Clickable portal in two days.', daysAgo: 34 },
  { from: 'kabir', to: 'ananya', title: 'Test IDs everywhere', note: 'Automation got so much easier.', daysAgo: 37 },
  { from: 'demo', to: 'sneha', title: 'Roadmap clarity', note: 'The Q4 roadmap doc is the clearest we have had.', daysAgo: 40 },
  { from: 'tanvi', to: 'meera', title: 'Pixel-perfect implementation', note: 'The onboarding screens match the designs exactly.', daysAgo: 44 },
  { from: 'arjun', to: 'vikram', title: 'Midnight database rescue', note: 'You restored the replica before anyone woke up.', daysAgo: 48 },
  { from: 'sneha', to: 'kabir', title: 'Quality gatekeeper', note: 'Zero P1 bugs this release.', daysAgo: 52 },
];

// ---- Linear issues + task updates ----------------------------------------------------------

export interface DemoTaskUpdate {
  author?: string; // defaults to the issue assignee
  daysAgo: number;
  status: TaskUpdateStatus;
  progress: number;
  minutes: number;
  body: string;
}

export interface DemoIssue {
  identifier: string;
  title: string;
  assignee: string;
  stateType: LinearWorkflowType;
  stateName: string;
  priority: number; // Linear: 1 urgent, 2 high, 3 medium, 4 low
  estimate: number;
  dueInDays?: number;
  updates: DemoTaskUpdate[];
}

export const ISSUES: DemoIssue[] = [
  {
    identifier: 'NIM-142', title: 'Move invoice PDF rendering to the job queue', assignee: 'vikram', stateType: 'started', stateName: 'In Progress', priority: 2, estimate: 5, dueInDays: 3,
    updates: [
      { daysAgo: 6, status: 'on_track', progress: 20, minutes: 180, body: 'Spiked BullMQ vs pg-boss. Going with pg-boss - no extra infra.' },
      { daysAgo: 4, status: 'on_track', progress: 45, minutes: 300, body: 'Worker renders PDFs; API now returns a job id and polls.' },
      { daysAgo: 1, status: 'at_risk', progress: 70, minutes: 240, body: 'Fonts render differently in the worker container. Investigating - {@demo} heads up, this may slip a day.' },
    ],
  },
  {
    identifier: 'NIM-138', title: 'Idempotent payment webhooks', assignee: 'neha', stateType: 'completed', stateName: 'Done', priority: 1, estimate: 3,
    updates: [
      { daysAgo: 12, status: 'on_track', progress: 30, minutes: 200, body: 'Added idempotency keys table and middleware.' },
      { daysAgo: 10, status: 'in_review', progress: 90, minutes: 150, body: 'PR up with retry + dead-letter queue. {@vikram} could you review?' },
      { daysAgo: 8, status: 'done', progress: 100, minutes: 60, body: 'Merged and deployed. Zero duplicate payments since.' },
    ],
  },
  {
    identifier: 'NIM-145', title: 'PgBouncer for the API database', assignee: 'arjun', stateType: 'started', stateName: 'In Review', priority: 2, estimate: 3, dueInDays: 1,
    updates: [
      { daysAgo: 5, status: 'on_track', progress: 40, minutes: 240, body: 'PgBouncer running in staging in transaction mode.' },
      { daysAgo: 2, status: 'in_review', progress: 85, minutes: 120, body: 'Load test at 2k rps: no connection errors. PR ready for review.' },
    ],
  },
  {
    identifier: 'NIM-149', title: 'Rotate production secrets', assignee: 'arjun', stateType: 'unstarted', stateName: 'Todo', priority: 1, estimate: 2, dueInDays: -1,
    updates: [],
  },
  {
    identifier: 'NIM-131', title: 'Invoice list filters and saved views', assignee: 'rahul', stateType: 'completed', stateName: 'Done', priority: 3, estimate: 5,
    updates: [
      { daysAgo: 16, status: 'on_track', progress: 35, minutes: 300, body: 'Filters by status, client and date range are working.' },
      { daysAgo: 13, status: 'in_review', progress: 90, minutes: 180, body: 'Saved views stored per user. Ready for QA - {@kabir}.' },
      { daysAgo: 11, status: 'done', progress: 100, minutes: 45, body: 'Released behind the invoices.filters flag.' },
    ],
  },
  {
    identifier: 'NIM-147', title: 'Client portal: invoice download page', assignee: 'rahul', stateType: 'started', stateName: 'In Progress', priority: 2, estimate: 8, dueInDays: 6,
    updates: [
      { daysAgo: 3, status: 'on_track', progress: 25, minutes: 270, body: 'Signed download links working end to end.' },
      { daysAgo: 0, status: 'blocked', progress: 40, minutes: 120, body: 'Blocked on design for the mobile layout. {@tanvi} could we sync today?' },
    ],
  },
  {
    identifier: 'NIM-136', title: 'Design tokens v2 with dark mode', assignee: 'meera', stateType: 'started', stateName: 'In Progress', priority: 3, estimate: 5, dueInDays: 4,
    updates: [
      { daysAgo: 9, status: 'on_track', progress: 40, minutes: 240, body: 'Semantic tokens defined; migrated buttons and inputs.' },
      { daysAgo: 4, status: 'on_track', progress: 70, minutes: 300, body: 'Tables, dialogs and charts migrated. Contrast checks pass.' },
      { daysAgo: 1, status: 'on_track', progress: 85, minutes: 180, body: 'Only the business documents left.' },
    ],
  },
  {
    identifier: 'NIM-151', title: 'Fix focus traps in modal dialogs', assignee: 'ananya', stateType: 'completed', stateName: 'Done', priority: 3, estimate: 2,
    updates: [
      { daysAgo: 8, status: 'in_review', progress: 90, minutes: 200, body: 'All dialogs trap focus and restore it on close.' },
      { daysAgo: 7, status: 'done', progress: 100, minutes: 30, body: 'Shipped. Screen reader pass by {@kabir} looks good.' },
    ],
  },
  {
    identifier: 'NIM-153', title: 'Playwright suite for the quotation flow', assignee: 'kabir', stateType: 'started', stateName: 'In Progress', priority: 3, estimate: 3, dueInDays: 5,
    updates: [
      { daysAgo: 4, status: 'on_track', progress: 50, minutes: 240, body: 'Create, issue and duplicate covered.' },
      { daysAgo: 1, status: 'on_track', progress: 75, minutes: 180, body: 'PDF preview and tax totals covered. Adding the international client case.' },
    ],
  },
  {
    identifier: 'NIM-155', title: 'Onboarding v2: team invite step', assignee: 'meera', stateType: 'unstarted', stateName: 'Todo', priority: 3, estimate: 3, dueInDays: 9,
    updates: [],
  },
  {
    identifier: 'NIM-129', title: 'GST rounding on credit notes', assignee: 'neha', stateType: 'completed', stateName: 'Done', priority: 2, estimate: 2,
    updates: [
      { daysAgo: 15, status: 'on_track', progress: 50, minutes: 180, body: 'Reproduced: rounding happened per line instead of on the total.' },
      { daysAgo: 14, status: 'done', progress: 100, minutes: 120, body: 'Fixed and backfilled 12 affected credit notes.' },
    ],
  },
  {
    identifier: 'NIM-157', title: 'Audit log export to CSV', assignee: 'vikram', stateType: 'backlog', stateName: 'Backlog', priority: 4, estimate: 2,
    updates: [],
  },
  {
    identifier: 'NIM-150', title: 'Grafana alerts for queue depth', assignee: 'arjun', stateType: 'completed', stateName: 'Done', priority: 3, estimate: 1,
    updates: [{ daysAgo: 9, status: 'done', progress: 100, minutes: 90, body: 'Alerts live with paging to the on-call rotation.' }],
  },
  {
    identifier: 'NIM-158', title: 'Command palette keyboard shortcuts', assignee: 'ananya', stateType: 'started', stateName: 'In Progress', priority: 4, estimate: 2, dueInDays: 7,
    updates: [{ daysAgo: 2, status: 'on_track', progress: 30, minutes: 150, body: 'Shortcut registry in place; wiring up the first 10 commands.' }],
  },
  {
    identifier: 'NIM-133', title: 'Legacy report endpoint', assignee: 'rahul', stateType: 'canceled', stateName: 'Canceled', priority: 4, estimate: 3,
    updates: [],
  },
];

// ---- Workspace (action items) -------------------------------------------------------------

export interface DemoComment {
  author: string;
  daysAgo: number;
  body: string;
}

export interface DemoWorkspaceItem {
  owner: string;
  assignedBy?: string;
  title: string;
  description: string;
  status: WorkspaceStatus;
  priority: WorkspacePriority;
  source: WorkspaceSource;
  createdDaysAgo: number;
  dueInDays?: number;
  completedDaysAgo?: number;
  isClientProject?: boolean;
  watchers?: string[];
  comments?: DemoComment[];
}

export const WORKSPACE_ITEMS: DemoWorkspaceItem[] = [
  {
    owner: 'demo', assignedBy: 'rohan', title: 'Prepare the board update: engineering metrics', status: 'IN_PROGRESS', priority: 'URGENT', source: 'SLACK', createdDaysAgo: 4, dueInDays: 3,
    description: 'Velocity, uptime, incident MTTR and hiring progress for the quarterly board deck.\n\n- [x] Pull uptime from Grafana\n- [ ] Hiring funnel numbers\n- [ ] Draft narrative',
    watchers: ['rohan'],
    comments: [
      { author: 'rohan', daysAgo: 3, body: 'Can we also include the cloud cost trend? The board asked last time.' },
      { author: 'demo', daysAgo: 2, body: 'Yes - {@arjun} can you share the last 6 months of spend by service?' },
      { author: 'arjun', daysAgo: 1, body: 'Exported to the shared drive. Spend is down 11% since the rightsizing.' },
    ],
  },
  {
    owner: 'demo', title: "Review Vikram's promotion packet", status: 'PENDING', priority: 'HIGH', source: 'MANUAL', createdDaysAgo: 6, dueInDays: 0,
    description: 'Senior → Staff. Read the packet, peer feedback and write the calibration notes.', watchers: ['karan'],
  },
  {
    owner: 'demo', assignedBy: 'farhan', title: 'Approve the reserved instance purchase', status: 'PENDING', priority: 'MEDIUM', source: 'EMAIL', createdDaysAgo: 7, dueInDays: -2,
    description: '1-year reserved capacity for the API and database. Saves about ₹38,000 per month.',
    comments: [{ author: 'farhan', daysAgo: 5, body: 'Quote attached in the email thread. Need sign-off before the 25th.' }],
  },
  {
    owner: 'demo', title: 'Acme Retail escalation: invoice sync delays', status: 'IN_PROGRESS', priority: 'URGENT', source: 'PHONE_CALL', createdDaysAgo: 1, dueInDays: 0, isClientProject: true,
    description: 'Acme Retail reports invoices taking 2+ hours to appear in their ERP. Coordinate the fix and the client update.', watchers: ['vikram', 'karan'],
    comments: [
      { author: 'vikram', daysAgo: 1, body: 'Root cause: the export job was retrying on a 429 without backoff. Fix is in NIM-142.' },
      { author: 'demo', daysAgo: 0, body: 'Thanks. {@karan} please own the client update once the fix is deployed.' },
    ],
  },
  {
    owner: 'demo', title: 'Plan the 1:1 agenda with Karan', status: 'PENDING', priority: 'LOW', source: 'MANUAL', createdDaysAgo: 2, dueInDays: 1,
    description: 'Hiring plan, on-call load, Vikram promotion.',
  },
  {
    owner: 'demo', assignedBy: 'rohan', title: 'Interview loop feedback: Senior Backend candidate', status: 'DONE', priority: 'MEDIUM', source: 'MEETING', createdDaysAgo: 9, dueInDays: -4, completedDaysAgo: 5,
    description: 'Consolidate the panel feedback and make the hire / no-hire call.',
  },
  {
    owner: 'demo', title: 'Publish the API outage postmortem', status: 'DONE', priority: 'HIGH', source: 'MEETING', createdDaysAgo: 12, dueInDays: -8, completedDaysAgo: 9,
    description: 'Timeline, root cause, action items. Share with the team and the affected clients.',
  },
  {
    owner: 'karan', assignedBy: 'demo', title: 'Draft the on-call rotation policy', status: 'IN_PROGRESS', priority: 'HIGH', source: 'MEETING', createdDaysAgo: 8, dueInDays: 2,
    description: 'Weekly rotation, escalation path, compensation for out-of-hours pages.', watchers: ['demo'],
    comments: [{ author: 'karan', daysAgo: 2, body: 'First draft is in the doc. {@demo} would love your eyes on the compensation part.' }],
  },
  {
    owner: 'sneha', assignedBy: 'demo', title: 'Scope client portal v1 milestones', status: 'PENDING', priority: 'HIGH', source: 'MEETING', createdDaysAgo: 5, dueInDays: 3,
    description: 'Break the portal into shippable milestones with owners and dates.', watchers: ['demo'],
  },
  {
    owner: 'vikram', assignedBy: 'karan', title: 'Benchmark Postgres connection pooling', status: 'DONE', priority: 'MEDIUM', source: 'LINEAR', createdDaysAgo: 14, dueInDays: -7, completedDaysAgo: 8,
    description: 'Compare PgBouncer transaction vs session mode under realistic load.',
  },
  {
    owner: 'arjun', assignedBy: 'karan', title: 'Rotate production secrets', status: 'PENDING', priority: 'URGENT', source: 'SLACK', createdDaysAgo: 6, dueInDays: -1,
    description: 'Quarterly rotation for database, payment gateway and email provider keys.', watchers: ['demo', 'karan'],
  },
  {
    owner: 'kabir', assignedBy: 'sneha', title: 'Regression pass for release 2.14', status: 'IN_PROGRESS', priority: 'HIGH', source: 'MANUAL', createdDaysAgo: 2, dueInDays: 0,
    description: 'Full manual + automated pass before Thursday\'s release.',
  },
  {
    owner: 'neha', assignedBy: 'farhan', title: 'Investigate the TDS line on Orbit invoices', status: 'PENDING', priority: 'HIGH', source: 'EMAIL', createdDaysAgo: 3, dueInDays: 4, isClientProject: true,
    description: 'Orbit Logistics wants TDS shown as a separate line on invoices.',
  },
  {
    owner: 'rahul', assignedBy: 'sneha', title: 'Client portal: invoice download page', status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'LINEAR', createdDaysAgo: 4, dueInDays: 6, isClientProject: true,
    description: 'Tracked in NIM-147.',
  },
  {
    owner: 'ananya', assignedBy: 'meera', title: 'Fix focus traps in modal dialogs', status: 'DONE', priority: 'LOW', source: 'LINEAR', createdDaysAgo: 11, dueInDays: -6, completedDaysAgo: 7,
    description: 'From the accessibility audit.',
  },
  {
    owner: 'tanvi', assignedBy: 'sneha', title: 'Usability test: onboarding v2', status: 'PENDING', priority: 'MEDIUM', source: 'MEETING', createdDaysAgo: 3, dueInDays: 5,
    description: 'Five sessions with new trial users.',
  },
  {
    owner: 'farhan', title: 'Send this month\'s invoices to clients', status: 'PENDING', priority: 'HIGH', source: 'MANUAL', createdDaysAgo: 1, dueInDays: 1,
    description: 'Acme Retail, Orbit Logistics and Brightpath.',
  },
  {
    owner: 'rohan', title: 'Investor update email', status: 'IN_PROGRESS', priority: 'MEDIUM', source: 'MANUAL', createdDaysAgo: 3, dueInDays: 4,
    description: 'Monthly update: revenue, hiring, product milestones.',
  },
  {
    owner: 'meera', assignedBy: 'sneha', title: 'Design QA for the checkout revamp', status: 'DONE', priority: 'MEDIUM', source: 'MEETING', createdDaysAgo: 10, dueInDays: -5, completedDaysAgo: 6,
    description: 'Compare implementation against the Figma screens.',
  },
];

// ---- Business operations ------------------------------------------------------------------

export const COMPANY = {
  legalName: 'Nimbus Labs Private Limited',
  displayName: 'Nimbus Labs',
  addressLine1: '4th Floor, Prestige Tech Park',
  addressLine2: 'Outer Ring Road, Marathahalli',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560103',
  country: 'India',
  gstin: '29AAHCN4821K1Z6',
  pan: 'AAHCN4821K',
  cin: 'U72900KA2021PTC145678',
  bankName: 'HDFC Bank',
  bankAccountName: 'Nimbus Labs Private Limited',
  bankAccountNumber: '50200061234567',
  bankIfsc: 'HDFC0001234',
  upiId: 'nimbuslabs@hdfcbank',
  contactEmail: `billing@${EMAIL_DOMAIN}`,
  contactPhone: '+91 80 4567 8900',
  website: 'https://nimbuslabs.example',
  invoiceFooterNotes: 'Thank you for your business! Payments are due within the agreed terms.',
  authorizedSignatoryName: 'Rohan Mehta',
  authorizedSignatoryDesignation: 'CEO & Co-founder',
};

export interface DemoClient {
  key: string;
  type: 'COMPANY' | 'INDIVIDUAL';
  name: string;
  companyName?: string;
  contactPersonName?: string;
  email: string;
  phone: string;
  website?: string;
  gstin?: string;
  taxId?: string;
  billingLine1: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  tags: string[];
  notes?: string;
  createdDaysAgo: number;
}

export const CLIENTS: DemoClient[] = [
  { key: 'acme', type: 'COMPANY', name: 'Acme Retail', companyName: 'Acme Retail Private Limited', contactPersonName: 'Pooja Krishnan', email: 'accounts@acmeretail.example', phone: '+91 80 2345 6789', website: 'https://acmeretail.example', gstin: '29AAACA7712M1Z3', billingLine1: '12 Residency Road', billingCity: 'Bengaluru', billingState: 'Karnataka', billingPostalCode: '560025', billingCountry: 'India', tags: ['retail', 'enterprise'], notes: 'Monthly retainer. Invoices go to the accounts team; CC Pooja.', createdDaysAgo: 200 },
  { key: 'orbit', type: 'COMPANY', name: 'Orbit Logistics', companyName: 'Orbit Logistics Limited', contactPersonName: 'Sameer Kulkarni', email: 'finance@orbitlogistics.example', phone: '+91 22 4010 2200', website: 'https://orbitlogistics.example', gstin: '27AABCO5521Q1Z8', billingLine1: 'Plot 44, MIDC Andheri East', billingCity: 'Mumbai', billingState: 'Maharashtra', billingPostalCode: '400093', billingCountry: 'India', tags: ['logistics'], createdDaysAgo: 185 },
  { key: 'greenfield', type: 'COMPANY', name: 'Greenfield Health', companyName: 'Greenfield Health Private Limited', contactPersonName: 'Dr. Lakshmi Narayanan', email: 'ap@greenfieldhealth.example', phone: '+91 44 2811 0099', gstin: '33AAFCG2231P1Z1', billingLine1: '8 Cathedral Road', billingCity: 'Chennai', billingState: 'Tamil Nadu', billingPostalCode: '600086', billingCountry: 'India', tags: ['healthcare'], createdDaysAgo: 170 },
  { key: 'brightpath', type: 'COMPANY', name: 'Brightpath EdTech', companyName: 'Brightpath Learning Private Limited', contactPersonName: 'Nikhil Arora', email: 'billing@brightpath.example', phone: '+91 11 4155 7788', gstin: '07AAICB9981H1ZQ', billingLine1: 'B-23 Connaught Place', billingCity: 'New Delhi', billingState: 'Delhi', billingPostalCode: '110001', billingCountry: 'India', tags: ['edtech', 'startup'], createdDaysAgo: 120 },
  { key: 'northwind', type: 'COMPANY', name: 'Northwind Analytics', companyName: 'Northwind Analytics Inc.', contactPersonName: 'Emily Carter', email: 'payables@northwind.example', phone: '+1 415 555 0142', website: 'https://northwind.example', taxId: 'EIN 94-3187721', billingLine1: '500 Howard Street', billingCity: 'San Francisco', billingState: 'California', billingPostalCode: '94105', billingCountry: 'United States', tags: ['international'], notes: 'Billed in USD. Export of services - zero-rated under LUT.', createdDaysAgo: 150 },
  { key: 'kavya', type: 'INDIVIDUAL', name: 'Kavya Menon', email: 'kavya.menon@mail.example', phone: '+91 98470 12345', billingLine1: '22 Marine Drive', billingCity: 'Kochi', billingState: 'Kerala', billingPostalCode: '682031', billingCountry: 'India', tags: ['individual'], createdDaysAgo: 75 },
];

export interface DemoLine {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount?: number;
}

export interface DemoPayment {
  /** Share of the grand total; the last payment of a fully-paid invoice settles the balance. */
  fraction: number;
  daysAfterIssue: number;
  method: PaymentMethod;
  reference: string;
}

export interface DemoInvoice {
  client: string;
  daysAgo: number;
  dueDays: number;
  /** draft = never issued; issued/sent leave a balance; cancelled is issued then cancelled. */
  plan: 'draft' | 'issued' | 'sent' | 'paid' | 'partial' | 'cancelled';
  invoiceType?: 'STANDARD' | 'PROFORMA' | 'ADVANCE';
  currency?: string;
  lines: DemoLine[];
  payments?: DemoPayment[];
  notes?: string;
}

const TERMS = 'Payment due within the agreed terms. Please quote the invoice number with your payment.';
export const INVOICE_TERMS = TERMS;

export const INVOICES: DemoInvoice[] = [
  { client: 'acme', daysAgo: 175, dueDays: 15, plan: 'paid', lines: [{ description: 'Custom software development - Sprint 9 (2 weeks)', quantity: 1, unit: 'sprint', unitPrice: 285000 }, { description: 'Cloud infrastructure management', quantity: 1, unit: 'month', unitPrice: 45000 }], payments: [{ fraction: 1, daysAfterIssue: 12, method: 'BANK_TRANSFER', reference: 'NEFT N2041887215' }] },
  { client: 'orbit', daysAgo: 160, dueDays: 30, plan: 'paid', lines: [{ description: 'Fleet tracking dashboard - milestone 1', quantity: 1, unit: 'milestone', unitPrice: 420000 }, { description: 'Discovery workshop', quantity: 2, unit: 'day', unitPrice: 40000 }], payments: [{ fraction: 1, daysAfterIssue: 27, method: 'BANK_TRANSFER', reference: 'RTGS ORBT0091273' }] },
  { client: 'greenfield', daysAgo: 150, dueDays: 30, plan: 'paid', lines: [{ description: 'Patient appointment app - design & prototype', quantity: 1, unit: 'project', unitPrice: 310000, discount: 10 }], payments: [{ fraction: 0.5, daysAfterIssue: 10, method: 'BANK_TRANSFER', reference: 'NEFT G1188201' }, { fraction: 1, daysAfterIssue: 35, method: 'CHEQUE', reference: 'CHQ 004512' }] },
  { client: 'northwind', daysAgo: 135, dueDays: 30, plan: 'paid', currency: 'USD', lines: [{ description: 'Data pipeline development', quantity: 120, unit: 'hour', unitPrice: 45 }, { description: 'Analytics dashboard build', quantity: 1, unit: 'project', unitPrice: 6500 }], payments: [{ fraction: 1, daysAfterIssue: 21, method: 'STRIPE', reference: 'pi_3PxNw2Demo41' }] },
  { client: 'acme', daysAgo: 115, dueDays: 15, plan: 'paid', lines: [{ description: 'Custom software development - Sprint 13 (2 weeks)', quantity: 1, unit: 'sprint', unitPrice: 285000 }, { description: 'UI/UX design retainer', quantity: 1, unit: 'month', unitPrice: 95000 }], payments: [{ fraction: 1, daysAfterIssue: 14, method: 'BANK_TRANSFER', reference: 'NEFT N2049920114' }] },
  { client: 'brightpath', daysAgo: 100, dueDays: 15, plan: 'cancelled', lines: [{ description: 'Learning app MVP - phase 1', quantity: 1, unit: 'project', unitPrice: 250000 }], notes: 'Superseded by the revised scope invoice.' },
  { client: 'kavya', daysAgo: 80, dueDays: 7, plan: 'paid', lines: [{ description: 'Portfolio website design & build', quantity: 1, unit: 'project', unitPrice: 65000 }], payments: [{ fraction: 1, daysAfterIssue: 4, method: 'UPI', reference: 'UPI 428817736512' }] },
  { client: 'orbit', daysAgo: 62, dueDays: 30, plan: 'partial', lines: [{ description: 'Fleet tracking dashboard - milestone 2', quantity: 1, unit: 'milestone', unitPrice: 420000 }, { description: 'Support & maintenance', quantity: 3, unit: 'month', unitPrice: 25000 }], payments: [{ fraction: 0.6, daysAfterIssue: 10, method: 'BANK_TRANSFER', reference: 'RTGS ORBT0093388' }] },
  { client: 'brightpath', daysAgo: 55, dueDays: 15, plan: 'paid', lines: [{ description: 'Learning app MVP - revised scope', quantity: 1, unit: 'project', unitPrice: 210000 }, { description: 'App store submission & setup', quantity: 1, unit: 'service', unitPrice: 15000 }], payments: [{ fraction: 1, daysAfterIssue: 13, method: 'RAZORPAY', reference: 'pay_OxB2demo7731' }] },
  { client: 'greenfield', daysAgo: 38, dueDays: 30, plan: 'sent', lines: [{ description: 'Patient appointment app - development sprint 1 & 2', quantity: 2, unit: 'sprint', unitPrice: 240000 }, { description: 'HIPAA-style security review', quantity: 1, unit: 'service', unitPrice: 60000 }] },
  { client: 'acme', daysAgo: 24, dueDays: 15, plan: 'partial', lines: [{ description: 'Custom software development - Sprint 17 (2 weeks)', quantity: 1, unit: 'sprint', unitPrice: 285000 }, { description: 'ERP integration (Tally)', quantity: 1, unit: 'project', unitPrice: 120000 }, { description: 'Cloud infrastructure management', quantity: 1, unit: 'month', unitPrice: 45000 }], payments: [{ fraction: 0.5, daysAfterIssue: 10, method: 'BANK_TRANSFER', reference: 'NEFT N2057731902' }] },
  { client: 'northwind', daysAgo: 12, dueDays: 30, plan: 'sent', currency: 'USD', lines: [{ description: 'Data pipeline development', quantity: 96, unit: 'hour', unitPrice: 45 }, { description: 'Monthly platform support', quantity: 1, unit: 'month', unitPrice: 1200 }] },
  { client: 'brightpath', daysAgo: 5, dueDays: 15, plan: 'issued', lines: [{ description: 'Learning app - live classes module', quantity: 1, unit: 'milestone', unitPrice: 180000 }, { description: 'Push notification setup', quantity: 1, unit: 'service', unitPrice: 20000, discount: 10 }] },
  { client: 'orbit', daysAgo: 1, dueDays: 30, plan: 'draft', lines: [{ description: 'Fleet tracking dashboard - milestone 3', quantity: 1, unit: 'milestone', unitPrice: 420000 }] },
  { client: 'acme', daysAgo: 0, dueDays: 7, plan: 'draft', invoiceType: 'PROFORMA', lines: [{ description: 'Mobile app - advance for phase 1', quantity: 1, unit: 'milestone', unitPrice: 350000 }], notes: 'Proforma for the advance payment. A tax invoice follows on receipt.' },
];

export interface DemoQuotation {
  client: string;
  daysAgo: number;
  validDays: number;
  outcome: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  currency?: string;
  lines: DemoLine[];
}

export const QUOTATIONS: DemoQuotation[] = [
  { client: 'orbit', daysAgo: 170, validDays: 30, outcome: 'accepted', lines: [{ description: 'Fleet tracking dashboard (3 milestones)', quantity: 3, unit: 'milestone', unitPrice: 420000 }, { description: 'Discovery workshop', quantity: 2, unit: 'day', unitPrice: 40000 }] },
  { client: 'brightpath', daysAgo: 110, validDays: 30, outcome: 'accepted', lines: [{ description: 'Learning app MVP', quantity: 1, unit: 'project', unitPrice: 250000 }] },
  { client: 'greenfield', daysAgo: 70, validDays: 21, outcome: 'rejected', lines: [{ description: 'Telemedicine video module', quantity: 1, unit: 'project', unitPrice: 540000 }] },
  { client: 'kavya', daysAgo: 60, validDays: 14, outcome: 'expired', lines: [{ description: 'E-commerce storefront', quantity: 1, unit: 'project', unitPrice: 145000 }] },
  { client: 'acme', daysAgo: 9, validDays: 30, outcome: 'sent', lines: [{ description: 'Mobile app - phase 1 (iOS + Android)', quantity: 1, unit: 'project', unitPrice: 1150000 }, { description: 'Support & maintenance', quantity: 6, unit: 'month', unitPrice: 35000, discount: 10 }] },
  { client: 'northwind', daysAgo: 2, validDays: 30, outcome: 'draft', currency: 'USD', lines: [{ description: 'Real-time analytics pipeline', quantity: 1, unit: 'project', unitPrice: 18000 }] },
];

export interface DemoProposal {
  client: string;
  title: string;
  reference: string;
  summary: string;
  daysAgo: number;
  validDays: number;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'APPROVED';
  sections: { title: string; content: string }[];
}

export const PROPOSALS: DemoProposal[] = [
  {
    client: 'acme', title: 'Acme Retail mobile app - phase 1', reference: 'NL-PROP-031', daysAgo: 10, validDays: 30, status: 'VIEWED',
    summary: 'A loyalty-first mobile app for Acme Retail customers, integrated with the existing POS and ERP.',
    sections: [
      { title: 'Objectives', content: '<ul><li>Launch iOS and Android apps with loyalty and offers</li><li>Real-time stock lookup from the ERP</li><li>Push campaigns managed by the marketing team</li></ul>' },
      { title: 'Scope of work', content: '<p>Design, development, QA and store submission for both platforms, plus an admin console for offers.</p>' },
      { title: 'Timeline', content: '<p><strong>12 weeks</strong>: 2 weeks discovery, 8 weeks build in 2-week sprints, 2 weeks hardening and launch.</p>' },
      { title: 'Team', content: '<p>1 engineering manager, 2 mobile engineers, 1 backend engineer, 1 designer, 1 QA engineer.</p>' },
    ],
  },
  {
    client: 'orbit', title: 'Fleet tracking platform - phase 2', reference: 'NL-PROP-028', daysAgo: 45, validDays: 30, status: 'APPROVED',
    summary: 'Driver app, route optimisation and SLA alerting on top of the phase 1 dashboard.',
    sections: [
      { title: 'Objectives', content: '<ul><li>Driver mobile app with proof of delivery</li><li>Route optimisation for 400+ daily deliveries</li><li>SLA breach alerts</li></ul>' },
      { title: 'Commercials', content: '<p>Fixed price across 3 milestones; support billed monthly.</p>' },
    ],
  },
  {
    client: 'greenfield', title: 'Telemedicine module', reference: 'NL-PROP-029', daysAgo: 30, validDays: 21, status: 'SENT',
    summary: 'Secure video consultations integrated with the appointment app.',
    sections: [
      { title: 'Approach', content: '<p>WebRTC with an SFU for group consults, end-to-end encryption for 1:1 calls.</p>' },
      { title: 'Compliance', content: '<p>Consent capture, audit trails and data residency in India.</p>' },
    ],
  },
  {
    client: 'northwind', title: 'Real-time analytics pipeline', reference: 'NL-PROP-032', daysAgo: 2, validDays: 30, status: 'DRAFT',
    summary: 'Streaming ingestion and sub-minute dashboards for Northwind clients.',
    sections: [{ title: 'Architecture', content: '<p>Kafka ingestion, ClickHouse storage, materialized views feeding the dashboard API.</p>' }],
  },
];

export interface DemoOffer {
  candidateName: string;
  candidateEmail: string;
  position: string;
  department: string;
  reportingManager: string;
  employmentType: EmploymentType;
  baseSalary: number;
  variablePay?: number;
  workLocation: string;
  startInDays: number;
  daysAgo: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
}

export const OFFER_LETTERS: DemoOffer[] = [
  { candidateName: 'Ishaan Verma', candidateEmail: 'ishaan.verma@mail.example', position: 'Senior Backend Engineer', department: 'Platform', reportingManager: 'Karan Malhotra', employmentType: 'FULL_TIME', baseSalary: 3200000, variablePay: 300000, workLocation: 'Bengaluru (Hybrid)', startInDays: 20, daysAgo: 21, status: 'ACCEPTED' },
  { candidateName: 'Riya Kapoor', candidateEmail: 'riya.kapoor@mail.example', position: 'Frontend Engineer', department: 'Product Engineering', reportingManager: 'Sneha Iyer', employmentType: 'FULL_TIME', baseSalary: 1800000, workLocation: 'Bengaluru (Hybrid)', startInDays: 30, daysAgo: 14, status: 'REJECTED' },
  { candidateName: 'Aman Siddiqui', candidateEmail: 'aman.siddiqui@mail.example', position: 'Backend Engineer', department: 'Platform', reportingManager: 'Karan Malhotra', employmentType: 'FULL_TIME', baseSalary: 2200000, variablePay: 150000, workLocation: 'Remote (India)', startInDays: 35, daysAgo: 4, status: 'SENT' },
  { candidateName: 'Zoya Khan', candidateEmail: 'zoya.khan@mail.example', position: 'Product Design Intern', department: 'Design', reportingManager: 'Sneha Iyer', employmentType: 'INTERNSHIP', baseSalary: 360000, workLocation: 'Bengaluru (On-site)', startInDays: 25, daysAgo: 1, status: 'DRAFT' },
];
