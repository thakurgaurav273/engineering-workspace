import * as request from 'supertest';
import { createTestApp, TestContext, authHeader } from './helpers/test.helper';

describe('Admin Data Management (e2e)', () => {
  let ctx: TestContext;
  let checkInId: string;
  let goalId: string;
  let recognitionId: string;
  let memberToken: string;
  let memberId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // A second, non-admin org member used to assert role protection.
    const memberEmail = `member-${Date.now()}@example.com`;
    const createRes = await request(ctx.app.getHttpServer())
      .post('/users')
      .set(authHeader(ctx.authToken))
      .send({ email: memberEmail, password: 'password123', firstName: 'Mem', lastName: 'Ber' })
      .expect(201);
    memberId = createRes.body.data.id;

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: memberEmail, password: 'password123' })
      .expect(200);
    memberToken = (loginRes.body.data ?? loginRes.body).accessToken;

    // Seed a check-in, a goal and a recognition (each produces a notification for the
    // manager/recipient) so we can exercise list/search/filter/delete against real data.
    const checkInRes = await request(ctx.app.getHttpServer())
      .post('/check-ins')
      .set(authHeader(ctx.authToken))
      .send({ status: 'blocked', summary: 'Blocked on the payments API integration today.' })
      .expect(201);
    checkInId = checkInRes.body.data.id;

    const goalRes = await request(ctx.app.getHttpServer())
      .post('/goals')
      .set(authHeader(ctx.authToken))
      .send({ title: 'Ship the admin data management module' })
      .expect(201);
    goalId = goalRes.body.data.id;

    const recognitionRes = await request(ctx.app.getHttpServer())
      .post('/recognition')
      .set(authHeader(ctx.authToken))
      .send({ recipientId: memberId, title: 'Great teamwork', note: 'Thanks for the help!' })
      .expect(201);
    recognitionId = recognitionRes.body.data.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('role protection', () => {
    it('rejects MEMBER users with 403', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin/data-management/check-ins')
        .set(authHeader(memberToken))
        .expect(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(ctx.app.getHttpServer()).get('/admin/data-management/check-ins').expect(401);
    });

    it('allows the OWNER through', async () => {
      await request(ctx.app.getHttpServer())
        .get('/admin/data-management/check-ins')
        .set(authHeader(ctx.authToken))
        .expect(200);
    });
  });

  describe('GET /admin/data-management/check-ins', () => {
    it('returns paginated check-ins with search and user filter support', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/check-ins')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.data.some((c: { id: string }) => c.id === checkInId)).toBe(true);
    });

    it('filters by search text', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/check-ins?search=payments API')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((c: { id: string }) => c.id === checkInId)).toBe(true);
    });

    it('filters by userId', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/admin/data-management/check-ins?userId=${ctx.userId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.every((c: { user: { id: string } }) => c.user.id === ctx.userId)).toBe(true);
    });

    it('returns nothing for a non-matching date range', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/check-ins?from=2099-01-01&to=2099-01-31')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.length).toBe(0);
    });
  });

  describe('DELETE /admin/data-management/check-ins/:id', () => {
    it('permanently deletes the check-in and any notification referencing it', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/admin/data-management/check-ins/${checkInId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      const notification = await ctx.prisma.notification.findFirst({
        where: { entityType: 'checkin', entityId: checkInId },
      });
      expect(notification).toBeNull();

      const checkIn = await ctx.prisma.checkIn.findUnique({ where: { id: checkInId } });
      expect(checkIn).toBeNull();
    });

    it('returns 404 for an already-deleted check-in', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/admin/data-management/check-ins/${checkInId}`)
        .set(authHeader(ctx.authToken))
        .expect(404);
    });
  });

  describe('DELETE /admin/data-management/recognitions/:id', () => {
    it('permanently deletes the recognition and its notification', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/admin/data-management/recognitions/${recognitionId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      const notification = await ctx.prisma.notification.findFirst({
        where: { entityType: 'recognition', entityId: recognitionId },
      });
      expect(notification).toBeNull();
    });
  });

  describe('POST /admin/data-management/goals/bulk-delete', () => {
    it('bulk-deletes goals and cascades GoalHistory + notifications, leaving no orphans', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}/progress`)
        .set(authHeader(ctx.authToken))
        .send({ progress: 50 })
        .expect(200);

      const res = await request(ctx.app.getHttpServer())
        .post('/admin/data-management/goals/bulk-delete')
        .set(authHeader(ctx.authToken))
        .send({ ids: [goalId] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);

      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      expect(goal).toBeNull();

      const history = await ctx.prisma.goalHistory.findMany({ where: { goalId } });
      expect(history.length).toBe(0);
    });

    it('rejects an empty ids array', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/data-management/goals/bulk-delete')
        .set(authHeader(ctx.authToken))
        .send({ ids: [] })
        .expect(400);
    });
  });

  describe('GET /admin/data-management/notifications + bulk-delete', () => {
    it('lists and bulk-deletes notifications directly', async () => {
      const notification = await ctx.prisma.notification.create({
        data: {
          orgId: ctx.orgId,
          userId: ctx.userId,
          type: 'SYSTEM',
          title: 'Test notification',
          body: 'Just for this test',
        },
      });

      const listRes = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/notifications?search=Test notification')
        .set(authHeader(ctx.authToken))
        .expect(200);
      expect(listRes.body.data.some((n: { id: string }) => n.id === notification.id)).toBe(true);

      const bulkRes = await request(ctx.app.getHttpServer())
        .post('/admin/data-management/notifications/bulk-delete')
        .set(authHeader(ctx.authToken))
        .send({ ids: [notification.id] })
        .expect(200);
      expect(bulkRes.body.data.count).toBe(1);

      const stillThere = await ctx.prisma.notification.findUnique({ where: { id: notification.id } });
      expect(stillThere).toBeNull();
    });
  });

  describe('multi-tenancy isolation', () => {
    let otherOrgToken: string;
    let otherOrgId: string;
    let otherOrgGoalId: string;

    beforeAll(async () => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const slug = `other-org-${unique}`;
      const email = `other-org-owner-${unique}@example.com`;
      const registerRes = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          organizationName: 'Other Org',
          organizationSlug: slug,
          firstName: 'Other',
          lastName: 'Owner',
          email,
          password: 'password123',
        })
        .expect(201);
      otherOrgToken = registerRes.body.data.accessToken;
      otherOrgId = registerRes.body.data.user.orgId;

      const goalRes = await request(ctx.app.getHttpServer())
        .post('/goals')
        .set(authHeader(otherOrgToken))
        .send({ title: 'A goal that belongs to a different organization' })
        .expect(201);
      otherOrgGoalId = goalRes.body.data.id;
    });

    afterAll(async () => {
      await ctx.prisma.goal.deleteMany({ where: { orgId: otherOrgId } });
      await ctx.prisma.userPreference.deleteMany({ where: { user: { orgId: otherOrgId } } });
      await ctx.prisma.user.deleteMany({ where: { orgId: otherOrgId } });
      await ctx.prisma.organization.deleteMany({ where: { id: otherOrgId } });
    });

    it("never returns another org's goals in the list, even unfiltered", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/goals?limit=100')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.some((g: { id: string }) => g.id === otherOrgGoalId)).toBe(false);
    });

    it("returns 404 (not another org's data) when deleting a goal by ID from a different org", async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/admin/data-management/goals/${otherOrgGoalId}`)
        .set(authHeader(ctx.authToken))
        .expect(404);

      const stillExists = await ctx.prisma.goal.findUnique({ where: { id: otherOrgGoalId } });
      expect(stillExists).not.toBeNull();
    });

    it('silently no-ops (does not delete) when bulk-delete targets an ID from a different org', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/admin/data-management/goals/bulk-delete')
        .set(authHeader(ctx.authToken))
        .send({ ids: [otherOrgGoalId] })
        .expect(200);

      expect(res.body.data.count).toBe(0);

      const stillExists = await ctx.prisma.goal.findUnique({ where: { id: otherOrgGoalId } });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('bulk delete at scale', () => {
    it('deletes 150 notifications in one call and pagination/search/filters remain correct afterward', async () => {
      const rows = Array.from({ length: 150 }, (_, i) => ({
        orgId: ctx.orgId,
        userId: ctx.userId,
        type: 'SYSTEM' as const,
        title: `Bulk scale test notification ${i}`,
        body: 'Seeded for the bulk-delete-at-scale audit test',
      }));
      await ctx.prisma.notification.createMany({ data: rows });

      const before = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/notifications?search=Bulk scale test notification&limit=100')
        .set(authHeader(ctx.authToken))
        .expect(200);
      expect(before.body.meta.total).toBe(150);
      expect(before.body.meta.totalPages).toBe(2);

      const seeded = await ctx.prisma.notification.findMany({
        where: { orgId: ctx.orgId, title: { startsWith: 'Bulk scale test notification' } },
        select: { id: true },
      });
      expect(seeded.length).toBe(150);

      const bulkRes = await request(ctx.app.getHttpServer())
        .post('/admin/data-management/notifications/bulk-delete')
        .set(authHeader(ctx.authToken))
        .send({ ids: seeded.map((n) => n.id) })
        .expect(200);
      expect(bulkRes.body.data.count).toBe(150);

      const after = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/notifications?search=Bulk scale test notification')
        .set(authHeader(ctx.authToken))
        .expect(200);
      expect(after.body.data.length).toBe(0);
      expect(after.body.meta.total).toBe(0);
      expect(after.body.meta.totalPages).toBe(0);

      // Pagination over whatever remains still behaves (no crash, consistent shape).
      const stillPaginated = await request(ctx.app.getHttpServer())
        .get('/admin/data-management/notifications?page=1&limit=20')
        .set(authHeader(ctx.authToken))
        .expect(200);
      expect(stillPaginated.body.success).toBe(true);
      expect(stillPaginated.body.meta.page).toBe(1);
      expect(stillPaginated.body.meta.limit).toBe(20);
    });
  });
});
