/**
 * Seeds - or re-seeds - a self-contained demo tenant ("Nimbus Labs", content in ./demo-seed/data)
 * with one sign-in that can explore every app: a Head of Engineering (ADMIN) with a team, months
 * of check-ins, goals, reviews, recognition, task updates, action items, and a full invoicing
 * history with clients, quotations, proposals, payments and offer letters.
 *
 * Re-running is safe and is how the demo stays fresh: it deletes the demo org - only an org this
 * script created, identified by a marker in its settings - and rebuilds it with dates relative to
 * today. Run it on a schedule to also undo whatever visitors changed.
 *
 * Business documents go through the real services (numbering, tax engine, client/company
 * snapshots, payment ledger) so they match what the app produces; engineering history is written
 * directly so it can be backdated. Mail, push and cron jobs are disabled for this process.
 *
 *   npm run db:seed:demo                 # apps/api, after a build (start:dev keeps dist current)
 *   node dist/scripts/seed-demo.js       # inside the API container (e.g. a Dokploy terminal/schedule)
 *
 * docker-compose fills DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD from NEXT_PUBLIC_DEMO_*, so the
 * seeded account is exactly the one the web sign-in page offers.
 *
 * Env: DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_ORG_SLUG.
 */
import { INestApplicationContext, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CheckInStatus, Prisma, ReviewType, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../kernel/flags/feature-flag.service';
import { NotificationPayload, NotificationTemplates } from '../platform/notifications/notification-templates';
import { CompanyService } from '../business-operations/company/company.service';
import { TaxService } from '../business-operations/tax/tax.service';
import { ClientsService } from '../business-operations/clients/clients.service';
import { InvoicesService } from '../business-operations/invoices/invoices.service';
import { PaymentsService } from '../business-operations/payments/payments.service';
import { QuotationsService } from '../business-operations/quotations/quotations.service';
import { ProposalsService } from '../business-operations/proposals/proposals.service';
import { OfferLettersService } from '../business-operations/offer-letters/offer-letters.service';
import { DocumentNumberingService } from '../business-operations/document-numbering/document-numbering.service';
import {
  BUSINESS_APP,
  CHECK_IN_BLOCKERS,
  CHECK_IN_SUMMARIES,
  CLIENTS,
  COMPANY,
  DemoLine,
  EMAIL_DOMAIN,
  ENGINEERING_APP,
  GOAL_NOTES,
  GOALS,
  INVOICE_TERMS,
  INVOICES,
  ISSUES,
  OFFER_LETTERS,
  ORG,
  PEOPLE,
  PROPOSALS,
  QUOTATIONS,
  RECOGNITIONS,
  REVIEW_CHALLENGES,
  REVIEW_FEEDBACK,
  REVIEW_LEARNINGS,
  REVIEW_WINS,
  WORKSPACE_ITEMS,
} from './demo-seed/data';

const ADMIN_EMAIL = (process.env.DEMO_ADMIN_EMAIL || `demo@${EMAIL_DOMAIN}`).toLowerCase();
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'Demo@12345';
const ORG_SLUG = process.env.DEMO_ORG_SLUG || 'nimbus-labs';
/** Set in OrganizationSettings.onboardingDefaults; the wipe refuses any org without it. */
const DEMO_MARKER = 'demoSeed';

// ---- Time: everything is relative to today, in UTC like the app's @db.Date columns ----------

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NOW = new Date();
const TODAY = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));

/** Midnight UTC `daysAgo` days back (negative = in the future). */
const day = (daysAgo: number): Date => new Date(TODAY.getTime() - daysAgo * DAY_MS);

/**
 * A moment on that day at `hourUtc`. Today's hours are squeezed into the part of the day that
 * has already passed, so nothing is stamped in the future and same-day order is kept.
 */
function at(daysAgo: number, hourUtc: number): Date {
  if (daysAgo === 0) {
    return new Date(TODAY.getTime() + (hourUtc / 24) * (NOW.getTime() - TODAY.getTime()));
  }
  return new Date(day(daysAgo).getTime() + hourUtc * HOUR_MS);
}

/** A due date `inDays` from today (negative = overdue), at 17:30 IST. */
const due = (inDays: number): Date => new Date(day(-inDays).getTime() + 12 * HOUR_MS);

const mondayOf = (d: Date): Date => new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS);

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Deterministic randomness (mulberry32): the same seed produces the same demo every run.
let prngState = 20261015;
function rand(): number {
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo: number, hi: number): number => lo + rand() * (hi - lo);
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];

/**
 * Service calls in flight at once. Each round trip to a remote database costs ~250ms, so
 * running documents side by side matters - but the services' interactive transactions give
 * up after 2s waiting for a pooled connection, so stay well under the pool size.
 */
const PARALLEL = 4;

/** `fn` over `items` with at most `limit` running at a time; results keep input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface SeededNotification {
  payload: NotificationPayload;
  at: Date;
}

class DemoSeeder {
  private readonly prisma: PrismaService;
  private orgId = '';
  private readonly users = new Map<string, User>();
  private readonly keyById = new Map<string, string>();
  private readonly memberships = new Map<string, string>();
  private readonly clients = new Map<string, string>();
  /** In-app notifications for the demo account, collected while seeding. */
  private readonly inbox: SeededNotification[] = [];
  private readonly counts: Record<string, number> = {};

  constructor(private readonly app: INestApplicationContext) {
    this.prisma = app.get(PrismaService);
  }

  private service<T>(type: Type<T>): T {
    return this.app.get(type, { strict: false });
  }

  private id(key: string): string {
    const user = this.users.get(key);
    if (!user) throw new Error(`Unknown demo person "${key}"`);
    return user.id;
  }

  private name(key: string): string {
    const user = this.users.get(key);
    return user ? `${user.firstName} ${user.lastName}` : key;
  }

  /** `{@key}` -> the editor's mention token, so mentions render and link like real ones. */
  private withMentions(text: string): string {
    return text.replace(/\{@(\w+)\}/g, (_, key: string) => `@[${this.name(key)}](mention:${this.id(key)})`);
  }

  async run(): Promise<void> {
    await this.wipe();
    await this.createOrg();
    await this.createPeople();
    await this.seedCheckIns();
    await this.seedGoals();
    await this.seedReviews();
    await this.seedRecognition();
    await this.seedTaskUpdates();
    await this.seedWorkspace();
    await this.seedBusiness();
    await this.seedInbox();
    this.report();
  }

  private async wipe(): Promise<void> {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: ORG_SLUG },
      include: { settings: true },
    });
    if (existing) {
      const marker = existing.settings?.onboardingDefaults as Record<string, unknown> | null | undefined;
      if (!marker?.[DEMO_MARKER]) {
        throw new Error(
          `Organization "${ORG_SLUG}" exists but was not created by this seed - refusing to delete it. ` +
            'Set DEMO_ORG_SLUG to a free slug.',
        );
      }
      const where = { orgId: existing.id };
      await this.prisma.$transaction(
        async (tx) => {
          // Rows without an ON DELETE CASCADE to the org or its users go first.
          await tx.taskUpdate.deleteMany({ where });
          await tx.linearIssue.deleteMany({ where });
          await tx.workspaceItem.deleteMany({ where });
          await tx.goal.deleteMany({ where });
          await tx.checkIn.deleteMany({ where });
          await tx.weeklyReview.deleteMany({ where });
          await tx.recognition.deleteMany({ where });
          await tx.notification.deleteMany({ where });
          await tx.pushDevice.deleteMany({ where });
          await tx.invitation.deleteMany({ where });
          await tx.payment.deleteMany({ where });
          await tx.invoice.deleteMany({ where });
          await tx.quotation.deleteMany({ where });
          await tx.proposal.deleteMany({ where });
          await tx.userRoleAssignment.deleteMany({ where });
          await tx.auditLog.deleteMany({ where });
          await tx.membership.deleteMany({ where });
          // Seeded accounts have the demo org as their home org. Anyone who joined it from
          // elsewhere keeps their account; only their membership and demo content go.
          await tx.user.deleteMany({ where });
          await tx.organization.delete({ where: { id: existing.id } });
        },
        { timeout: 120_000 },
      );
      console.log(`Removed the previous "${ORG_SLUG}" demo org.`);
    }

    const clash = await this.prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (clash) {
      throw new Error(`${ADMIN_EMAIL} already belongs to a real account. Set DEMO_ADMIN_EMAIL to another address.`);
    }
  }

  private async createOrg(): Promise<void> {
    const oldest = Math.max(...PEOPLE.map((p) => p.joinedDaysAgo));
    const org = await this.prisma.organization.create({
      data: {
        name: ORG.name,
        slug: ORG_SLUG,
        description: ORG.description,
        createdAt: at(oldest, 4),
        settings: { create: { onboardingDefaults: { [DEMO_MARKER]: true } } },
      },
    });
    this.orgId = org.id;
    await this.prisma.applicationInstallation.createMany({
      data: [ENGINEERING_APP, BUSINESS_APP].map((applicationKey) => ({
        orgId: org.id,
        applicationKey,
        state: 'INSTALLED' as const,
      })),
    });
  }

  private async createPeople(): Promise<void> {
    // Teammates get an unguessable password nobody knows; only the demo account can sign in.
    const [teamHash, adminHash] = await Promise.all([
      bcrypt.hash(randomBytes(24).toString('base64url'), 12),
      bcrypt.hash(ADMIN_PASSWORD, 12),
    ]);

    // PEOPLE lists every manager before their reports, so manager ids already exist here.
    for (const p of PEOPLE) {
      const isAdmin = p.key === 'demo';
      const joined = at(p.joinedDaysAgo, 4.5);
      const user = await this.prisma.user.create({
        data: {
          email: isAdmin ? ADMIN_EMAIL : `${p.firstName}.${p.lastName}@${EMAIL_DOMAIN}`.toLowerCase(),
          passwordHash: isAdmin ? adminHash : teamHash,
          firstName: p.firstName,
          lastName: p.lastName,
          // Legacy mirror fields, set the same way registration does.
          orgId: this.orgId,
          jobTitle: p.jobTitle,
          department: p.department,
          role: p.role,
          defaultOrganizationId: this.orgId,
          lastActiveOrganizationId: this.orgId,
          managerId: p.manager ? this.id(p.manager) : null,
          createdAt: joined,
        },
      });
      this.users.set(p.key, user);
      this.keyById.set(user.id, p.key);
      const membership = await this.prisma.membership.create({
        data: {
          userId: user.id,
          orgId: this.orgId,
          role: p.role,
          status: 'ACTIVE',
          jobTitle: p.jobTitle,
          department: p.department,
          joinedAt: joined,
          lastSeenAt: isAdmin ? NOW : at(Math.floor(between(0, 3)), between(4, 12)),
          invitedByMembershipId: this.memberships.get('rohan') ?? null,
          managerId: p.manager ? this.memberships.get(p.manager) : null,
          createdAt: joined,
        },
      });
      this.memberships.set(p.key, membership.id);
    }

    await this.prisma.userPreference.createMany({
      data: PEOPLE.map((p) => ({ userId: this.id(p.key), timezone: 'Asia/Kolkata' })),
    });
    await this.prisma.userApplicationAccess.createMany({
      data: PEOPLE.flatMap((p) =>
        p.apps.map((applicationKey) => ({ orgId: this.orgId, userId: this.id(p.key), applicationKey, granted: true })),
      ),
    });
    this.counts.people = PEOPLE.length;
  }

  private async seedCheckIns(): Promise<void> {
    const rows: Prisma.CheckInCreateManyInput[] = [];
    for (let d = 41; d >= 0; d--) {
      const weekday = day(d).getUTCDay();
      if (d > 0 && (weekday === 0 || weekday === 6)) continue;
      for (const p of PEOPLE) {
        if (!p.engineering) continue;
        // Leave today's check-in for whoever is exploring the demo account to try.
        if (d === 0 && p.key === 'demo') continue;
        if (rand() > (d === 0 ? 0.7 : 0.9)) continue;
        const roll = rand();
        const status: CheckInStatus = roll < 0.08 ? 'blocked' : roll < 0.22 ? 'completed' : 'on_track';
        const createdAt = at(d, between(3.5, 6.5));
        rows.push({
          orgId: this.orgId,
          userId: this.id(p.key),
          date: day(d),
          status,
          summary: pick(CHECK_IN_SUMMARIES[p.department] ?? CHECK_IN_SUMMARIES.Engineering),
          blockers: status === 'blocked' ? pick(CHECK_IN_BLOCKERS) : null,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
    const created = await this.prisma.checkIn.createManyAndReturn({ data: rows });
    this.counts.checkIns = created.length;

    const recentBlocked = created
      .filter((c) => c.status === 'blocked' && c.date >= day(3))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (recentBlocked) {
      this.inbox.push({
        payload: NotificationTemplates.checkInBlocked(this.name(this.keyById.get(recentBlocked.userId) ?? ''), recentBlocked.id),
        at: recentBlocked.createdAt,
      });
    }
    for (const c of created) {
      const key = this.keyById.get(c.userId);
      if ((key === 'karan' || key === 'sneha') && c.date >= day(1)) {
        this.inbox.push({ payload: NotificationTemplates.checkInCreated(this.name(key), c.id), at: c.createdAt });
      }
    }
  }

  private async seedGoals(): Promise<void> {
    // Progress history in even steps from creation to completion (or yesterday).
    const histories = GOALS.map((g) => {
      const completed = g.completedDaysAgo !== undefined;
      const endDaysAgo = g.completedDaysAgo ?? 1;
      const steps = Math.max(2, Math.round(g.progress / 20));
      return Array.from({ length: steps }, (_, i) => {
        const step = i + 1;
        const daysAgo = Math.round(g.createdDaysAgo - ((g.createdDaysAgo - endDaysAgo) * step) / steps);
        return {
          progress: Math.round((g.progress * step) / steps),
          note: completed && step === steps ? GOAL_NOTES[GOAL_NOTES.length - 1] : GOAL_NOTES[Math.min(i, GOAL_NOTES.length - 2)],
          createdAt: at(daysAgo, 10),
        };
      });
    });
    const goals = await this.prisma.goal.createManyAndReturn({
      data: GOALS.map((g, i) => ({
        orgId: this.orgId,
        userId: this.id(g.owner),
        title: g.title,
        description: g.description,
        progress: g.progress,
        status: g.completedDaysAgo !== undefined ? ('completed' as const) : ('active' as const),
        visibility: g.visibility,
        assignedById: g.assignedBy ? this.id(g.assignedBy) : null,
        dueDate: due(g.dueInDays),
        completedAt: g.completedDaysAgo !== undefined ? at(g.completedDaysAgo, 11) : null,
        createdAt: at(g.createdDaysAgo, 5),
        updatedAt: histories[i][histories[i].length - 1].createdAt,
      })),
    });
    // RETURNING order isn't guaranteed - match rows back by owner + title.
    const goalId = new Map(goals.map((g) => [`${g.userId}|${g.title}`, g.id]));
    const idFor = (i: number): string => goalId.get(`${this.id(GOALS[i].owner)}|${GOALS[i].title}`) ?? '';
    await this.prisma.goalHistory.createMany({
      data: histories.flatMap((history, i) => history.map((h) => ({ goalId: idFor(i), ...h }))),
    });

    GOALS.forEach((g, i) => {
      if (g.owner === 'demo' && g.assignedBy) {
        this.inbox.push({
          payload: NotificationTemplates.goalAssigned(this.name(g.assignedBy), idFor(i), g.title),
          at: at(g.createdDaysAgo, 5),
        });
      }
    });
    this.counts.goals = GOALS.length;
  }

  private async seedReviews(): Promise<void> {
    const rows: Prisma.WeeklyReviewCreateManyInput[] = [];
    const thisMonday = mondayOf(TODAY);
    const reviewers = PEOPLE.filter((p) => p.engineering);

    for (let w = 4; w >= 0; w--) {
      const weekStart = new Date(thisMonday.getTime() - w * 7 * DAY_MS);
      const mondayDaysAgo = Math.round((TODAY.getTime() - weekStart.getTime()) / DAY_MS);
      const fridayDaysAgo = Math.max(0, mondayDaysAgo - 4);

      for (const p of reviewers) {
        // Self reviews: past weeks submitted on Friday; this week a few drafts in progress.
        if (w > 0 ? rand() < 0.93 : rand() < 0.45 && p.key !== 'demo') {
          const submitted = w > 0;
          const stamp = at(submitted ? fridayDaysAgo : 0, between(8, 12));
          rows.push({
            orgId: this.orgId,
            revieweeId: this.id(p.key),
            reviewerId: this.id(p.key),
            type: ReviewType.self,
            weekStart,
            wins: pick(REVIEW_WINS),
            challenges: pick(REVIEW_CHALLENGES),
            learning: pick(REVIEW_LEARNINGS),
            status: submitted ? 'submitted' : 'draft',
            submittedAt: submitted ? stamp : null,
            createdAt: stamp,
            updatedAt: stamp,
          });
        }
        // Manager reviews land the following Monday/Tuesday. Last week's are partly still
        // pending - including the demo account's own reports, so there is one to write.
        if (!p.manager || w === 0) continue;
        if (w === 1 && (p.manager === 'demo' || rand() < 0.35)) continue;
        const stamp = at(Math.max(0, mondayDaysAgo - 7 - Math.round(rand())), between(6, 11));
        rows.push({
          orgId: this.orgId,
          revieweeId: this.id(p.key),
          reviewerId: this.id(p.manager),
          type: ReviewType.manager,
          weekStart,
          wins: pick(REVIEW_WINS),
          feedback: pick(REVIEW_FEEDBACK),
          rating: rand() < 0.15 ? 3 : rand() < 0.55 ? 4 : 5,
          status: 'submitted',
          submittedAt: stamp,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }
    const created = await this.prisma.weeklyReview.createManyAndReturn({ data: rows });
    this.counts.reviews = created.length;

    const latestFromRohan = created
      .filter((r) => r.type === 'manager' && r.revieweeId === this.id('demo'))
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())[0];
    if (latestFromRohan?.submittedAt) {
      this.inbox.push({
        payload: NotificationTemplates.reviewCompleted(this.name('rohan'), latestFromRohan.id),
        at: latestFromRohan.submittedAt,
      });
    }
  }

  private async seedRecognition(): Promise<void> {
    const rows = await this.prisma.recognition.createManyAndReturn({
      data: RECOGNITIONS.map((r) => ({
        orgId: this.orgId,
        authorId: this.id(r.from),
        recipientId: this.id(r.to),
        title: r.title,
        note: r.note,
        createdAt: at(r.daysAgo, between(5, 11)),
      })),
    });
    for (const row of rows) {
      if (row.recipientId !== this.id('demo')) continue;
      this.inbox.push({
        payload: NotificationTemplates.recognitionReceived(this.name(this.keyById.get(row.authorId) ?? ''), row.title, row.id),
        at: row.createdAt,
      });
    }
    this.counts.recognitions = rows.length;
  }

  /** Linear issues as if synced (no API key is stored, so the real sync leaves them alone). */
  private async seedTaskUpdates(): Promise<void> {
    const issues = await this.prisma.linearIssue.createManyAndReturn({
      data: ISSUES.map((issue) => ({
        orgId: this.orgId,
        linearId: randomUUID(),
        identifier: issue.identifier,
        title: issue.title,
        url: `https://linear.app/${ORG_SLUG}/issue/${issue.identifier}`,
        stateName: issue.stateName,
        stateType: issue.stateType,
        priority: issue.priority,
        estimate: issue.estimate,
        dueDate: issue.dueInDays !== undefined ? due(issue.dueInDays) : null,
        assigneeId: this.id(issue.assignee),
        syncedAt: NOW,
        createdAt: at(Math.max(0, ...issue.updates.map((u) => u.daysAgo)) + 2, 5),
      })),
    });
    const issueId = new Map(issues.map((i) => [i.identifier, i.id]));

    const planned = ISSUES.flatMap((issue) =>
      issue.updates.map((u) => {
        const author = u.author ?? issue.assignee;
        const createdAt = at(u.daysAgo, between(7, 12));
        return {
          issue,
          update: u,
          author,
          row: {
            orgId: this.orgId,
            issueId: issueId.get(issue.identifier) ?? '',
            authorId: this.id(author),
            body: this.withMentions(u.body),
            progress: u.progress,
            status: u.status,
            timeSpentMinutes: u.minutes,
            createdAt,
            updatedAt: createdAt,
          },
        };
      }),
    );
    const created = await this.prisma.taskUpdate.createManyAndReturn({ data: planned.map((p) => p.row) });
    const updateId = new Map(created.map((u) => [`${u.issueId}|${u.body}`, u.id]));

    for (const { issue, update, author, row } of planned) {
      const id = updateId.get(`${row.issueId}|${row.body}`) ?? '';
      if (update.body.includes('{@demo}')) {
        this.inbox.push({
          payload: NotificationTemplates.mentioned(this.name(author), {
            surface: 'task-update',
            entityId: id,
            label: issue.identifier,
            actionUrl: `/task-updates/${row.issueId}`,
          }),
          at: row.createdAt,
        });
      } else if (update.daysAgo <= 1) {
        this.inbox.push({
          payload: NotificationTemplates.taskUpdatePosted(this.name(author), issue.identifier, row.issueId, id),
          at: row.createdAt,
        });
      }
    }
    this.counts.issues = issues.length;
    this.counts.taskUpdates = created.length;
  }

  private async seedWorkspace(): Promise<void> {
    const commentsFor = WORKSPACE_ITEMS.map((item) =>
      (item.comments ?? []).map((c, i) => ({
        author: c.author,
        mentionsDemo: c.author !== 'demo' && c.body.includes('{@demo}'),
        authorId: this.id(c.author),
        body: this.withMentions(c.body),
        createdAt: at(c.daysAgo, 6 + i),
      })),
    );
    const items = await this.prisma.workspaceItem.createManyAndReturn({
      data: WORKSPACE_ITEMS.map((item, i) => {
        const createdAt = at(item.createdDaysAgo, 5.5);
        // Whoever delegated an item keeps watching it.
        const watchers = new Set([...(item.watchers ?? []), ...(item.assignedBy ? [item.assignedBy] : [])]);
        watchers.delete(item.owner);
        return {
          orgId: this.orgId,
          ownerId: this.id(item.owner),
          assignedById: item.assignedBy ? this.id(item.assignedBy) : null,
          title: item.title,
          description: this.withMentions(item.description),
          status: item.status,
          priority: item.priority,
          source: item.source,
          dueDate: item.dueInDays !== undefined ? due(item.dueInDays) : null,
          completedAt: item.completedDaysAgo !== undefined ? at(item.completedDaysAgo, 10) : null,
          isClientProject: !!item.isClientProject,
          watcherIds: [...watchers].map((key) => this.id(key)),
          createdAt,
          updatedAt: [createdAt, ...commentsFor[i].map((c) => c.createdAt)].sort((a, b) => b.getTime() - a.getTime())[0],
        };
      }),
    });
    // Titles are unique within the demo data, so they map rows back to their source.
    const itemId = new Map(items.map((row) => [row.title, row.id]));
    await this.prisma.workspaceItemComment.createMany({
      data: WORKSPACE_ITEMS.flatMap((item, i) =>
        commentsFor[i].map(({ authorId, body, createdAt }) => ({ itemId: itemId.get(item.title) ?? '', authorId, body, createdAt })),
      ),
    });

    WORKSPACE_ITEMS.forEach((item, i) => {
      const id = itemId.get(item.title) ?? '';
      if (item.owner === 'demo' && item.assignedBy) {
        this.inbox.push({
          payload: NotificationTemplates.workspaceItemAssigned(this.name(item.assignedBy), id, item.title),
          at: at(item.createdDaysAgo, 5.5),
        });
      }
      for (const c of commentsFor[i]) {
        if (!c.mentionsDemo) continue;
        this.inbox.push({
          payload: NotificationTemplates.mentioned(this.name(c.author), {
            surface: 'workspace-item',
            entityId: id,
            label: item.title,
            actionUrl: `/workspace/${id}`,
          }),
          at: c.createdAt,
        });
      }
    });
    this.counts.workspaceItems = items.length;
  }

  private async seedBusiness(): Promise<void> {
    const orgId = this.orgId;
    const invoices = this.service(InvoicesService);
    const payments = this.service(PaymentsService);
    const quotations = this.service(QuotationsService);
    const proposals = this.service(ProposalsService);
    const offers = this.service(OfferLettersService);
    const numbering = this.service(DocumentNumberingService);

    // Company + tax first: every document snapshots them at creation.
    await Promise.all([
      this.service(CompanyService).upsert(orgId, COMPANY),
      this.service(TaxService).updateConfig(orgId, {
        regime: 'IN_GST',
        homeCountry: 'India',
        defaultGstRate: 18,
        priceMode: 'EXCLUSIVE',
        roundingMode: 'NEAREST',
      }),
    ]);

    // Independent documents are created PARALLEL at a time; only number reservation runs in
    // order, so numbers increase with document dates (the data is listed oldest first).
    const clientsService = this.service(ClientsService);
    await mapLimit(CLIENTS, PARALLEL, async ({ key, createdDaysAgo, ...dto }) => {
      const client = await clientsService.create(orgId, dto);
      await this.prisma.client.update({ where: { id: client.id }, data: { createdAt: at(createdDaysAgo, 6) } });
      this.clients.set(key, client.id);
    });
    const clientId = (key: string): string => {
      const found = this.clients.get(key);
      if (!found) throw new Error(`Unknown demo client "${key}"`);
      return found;
    };
    // GST on every line; the tax engine splits CGST/SGST vs IGST and zero-rates exports.
    const lines = (items: DemoLine[]) =>
      items.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        discount: l.discount,
        discountType: 'PERCENT' as const,
        taxes: [{ type: 'GST' as const, rate: 18 }],
      }));

    const invoiceDrafts = await mapLimit(INVOICES, PARALLEL, (inv) =>
      invoices.create(orgId, {
        clientId: clientId(inv.client),
        invoiceType: inv.invoiceType,
        currency: inv.currency,
        notes: inv.notes,
        terms: INVOICE_TERMS,
        dueDate: due(inv.dueDays - inv.daysAgo).toISOString(),
        priceMode: 'EXCLUSIVE',
        lines: lines(inv.lines),
      }),
    );
    for (const [i, inv] of INVOICES.entries()) {
      if (inv.plan !== 'draft') await invoices.issue(invoiceDrafts[i].id, orgId);
    }
    const paymentCounts = await mapLimit(INVOICES, PARALLEL, async (inv, i) => {
      const draft = invoiceDrafts[i];
      const issuedAt = at(inv.daysAgo, 5);
      await this.prisma.invoice.update({
        where: { id: draft.id },
        data:
          inv.plan === 'draft'
            ? { createdAt: issuedAt, updatedAt: issuedAt }
            : {
                issueDate: issuedAt,
                issuedAt,
                createdAt: at(inv.daysAgo, 4),
                updatedAt: issuedAt,
                ...(inv.plan === 'issued' ? {} : { status: 'SENT' as const }),
              },
      });
      // One invoice's payments run in order: each one re-derives the invoice's paid status.
      let paid = 0;
      for (const [n, p] of (inv.payments ?? []).entries()) {
        const settles = inv.plan === 'paid' && n === (inv.payments ?? []).length - 1;
        const amount = settles ? round2(draft.grandTotal - paid) : round2(draft.grandTotal * p.fraction);
        const paidAt = at(Math.max(0, inv.daysAgo - p.daysAfterIssue), 6);
        const payment = await payments.create(orgId, {
          invoiceId: draft.id,
          amount,
          paymentDate: paidAt.toISOString(),
          method: p.method,
          reference: p.reference,
        });
        await this.prisma.payment.update({ where: { id: payment.id }, data: { createdAt: paidAt, updatedAt: paidAt } });
        paid = round2(paid + amount);
      }
      if (inv.plan === 'cancelled') await invoices.cancel(draft.id, orgId);
      return inv.payments?.length ?? 0;
    });

    const quotationStatus = { sent: 'SENT', accepted: 'ACCEPTED', rejected: 'REJECTED', expired: 'EXPIRED' } as const;
    const quotationDrafts = await mapLimit(QUOTATIONS, PARALLEL, (q) =>
      quotations.create(orgId, {
        clientId: clientId(q.client),
        currency: q.currency,
        terms: 'Prices valid until the expiry date. 40% advance to begin work, balance on milestones.',
        expiryDate: due(q.validDays - q.daysAgo).toISOString(),
        priceMode: 'EXCLUSIVE',
        lines: lines(q.lines),
      }),
    );
    for (const [i, q] of QUOTATIONS.entries()) {
      if (q.outcome !== 'draft') await quotations.issue(quotationDrafts[i].id, orgId);
    }
    await mapLimit(QUOTATIONS, PARALLEL, async (q, i) => {
      const issuedAt = at(q.daysAgo, 5);
      await this.prisma.quotation.update({
        where: { id: quotationDrafts[i].id },
        data:
          q.outcome === 'draft'
            ? { createdAt: issuedAt, updatedAt: issuedAt }
            : {
                // Sent / accepted / rejected normally follow an email to the client - set directly.
                status: quotationStatus[q.outcome],
                issueDate: issuedAt,
                issuedAt,
                createdAt: at(q.daysAgo, 4),
                updatedAt: at(Math.max(0, q.daysAgo - 3), 8),
              },
      });
    });

    await mapLimit(PROPOSALS, PARALLEL, async (p) => {
      const draft = await proposals.create(orgId, {
        clientId: clientId(p.client),
        title: p.title,
        reference: p.reference,
        summary: p.summary,
        validUntil: due(p.validDays - p.daysAgo).toISOString(),
        sections: p.sections.map((s, order) => ({ ...s, order })),
      });
      const sentAt = at(p.daysAgo, 7);
      await this.prisma.proposal.update({
        where: { id: draft.id },
        data: {
          status: p.status,
          sentAt: p.status === 'DRAFT' ? null : sentAt,
          createdAt: at(p.daysAgo + 1, 6),
          updatedAt: sentAt,
        },
      });
    });

    const offerDrafts = await mapLimit(OFFER_LETTERS, PARALLEL, (o) =>
      offers.create(orgId, {
        candidateName: o.candidateName,
        candidateEmail: o.candidateEmail,
        position: o.position,
        designation: o.position,
        department: o.department,
        reportingManager: o.reportingManager,
        employmentType: o.employmentType,
        baseSalary: o.baseSalary,
        variablePay: o.variablePay,
        currency: 'INR',
        workLocation: o.workLocation,
        startDate: due(o.startInDays).toISOString(),
        offerDate: at(o.daysAgo, 5).toISOString(),
        validUntil: due(7 - o.daysAgo).toISOString(),
        noticePeriod: '60 days',
        probationPeriod: o.employmentType === 'INTERNSHIP' ? 'Not applicable' : '3 months',
        signatoryUserId: this.id('rohan'),
      }),
    );
    // The number is reserved when an offer is emailed; reserve it the same way.
    const offerNumbers: (string | null)[] = [];
    for (const o of OFFER_LETTERS) {
      offerNumbers.push(o.status === 'DRAFT' ? null : (await numbering.next(orgId, 'OFFER_LETTER')).number);
    }
    await mapLimit(OFFER_LETTERS, PARALLEL, async (o, i) => {
      const offerDate = at(o.daysAgo, 5);
      await this.prisma.offerLetter.update({
        where: { id: offerDrafts[i].id },
        data:
          o.status === 'DRAFT'
            ? { createdAt: offerDate, updatedAt: offerDate }
            : {
                number: offerNumbers[i],
                status: o.status,
                sentAt: offerDate,
                acceptedAt: o.status === 'ACCEPTED' ? at(Math.max(0, o.daysAgo - 3), 9) : null,
                rejectedAt: o.status === 'REJECTED' ? at(Math.max(0, o.daysAgo - 2), 9) : null,
                createdAt: offerDate,
                updatedAt: offerDate,
              },
      });
    });

    this.counts.clients = CLIENTS.length;
    this.counts.invoices = INVOICES.length;
    this.counts.payments = paymentCounts.reduce((sum, n) => sum + n, 0);
    this.counts.quotations = QUOTATIONS.length;
    this.counts.proposals = PROPOSALS.length;
    this.counts.offerLetters = OFFER_LETTERS.length;
  }

  /** The demo account's bell: everything from the last two days unread, older ones read. */
  private async seedInbox(): Promise<void> {
    const readBefore = at(2, 0);
    await this.prisma.notification.createMany({
      data: this.inbox.map(({ payload, at: createdAt }) => {
        const isRead = createdAt < readBefore;
        return {
          orgId: this.orgId,
          userId: this.id('demo'),
          type: payload.type,
          title: payload.title,
          body: payload.body,
          entityType: payload.entityType,
          entityId: payload.entityId,
          actionUrl: payload.actionUrl,
          metadata: payload.metadata as Prisma.InputJsonValue | undefined,
          isRead,
          readAt: isRead ? new Date(createdAt.getTime() + HOUR_MS) : null,
          createdAt,
        };
      }),
    });
    this.counts.notifications = this.inbox.length;
  }

  private report(): void {
    const c = this.counts;
    console.log(`\nDemo tenant ready: ${ORG.name} (/${ORG_SLUG})`);
    console.log(`  Sign in:  ${ADMIN_EMAIL}`);
    console.log(`  Password: ${process.env.DEMO_ADMIN_PASSWORD ? '(from DEMO_ADMIN_PASSWORD)' : ADMIN_PASSWORD}`);
    console.log(
      `  ${c.people} people · ${c.checkIns} check-ins · ${c.goals} goals · ${c.reviews} reviews · ` +
        `${c.recognitions} recognitions · ${c.issues} issues / ${c.taskUpdates} updates · ${c.workspaceItems} action items`,
    );
    console.log(
      `  ${c.clients} clients · ${c.invoices} invoices · ${c.payments} payments · ${c.quotations} quotations · ` +
        `${c.proposals} proposals · ${c.offerLetters} offer letters · ${c.notifications} notifications`,
    );
    if (!this.service(FeatureFlagService).isEnabled('business-operations')) {
      console.warn(
        '\n  Note: the business-operations feature flag is off in this environment, so Business Operations ' +
          'is hidden. Set FEATURE_FLAGS=\'{"business-operations":true}\' for the API.',
      );
    }
  }
}

async function main(): Promise<void> {
  // This process must never email, push or run scheduled jobs - see common/safe-mode.ts.
  process.env.STAGING_SAFE_MODE = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    await new DemoSeeder(app).run();
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
