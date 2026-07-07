import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp, createTestMember, TestContext, authHeader } from './helpers/test.helper';

describe('Task Updates (e2e)', () => {
  let ctx: TestContext;
  let reportId: string;
  let reportToken: string;
  let issueId: string;
  let taskUpdateId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Seed a direct report (MEMBER) whose issues/updates the owner can manage.
    const passwordHash = await bcrypt.hash('password123', 12);
    const report = await createTestMember(ctx, {
      email: `report-${Date.now()}@example.com`,
      passwordHash,
      firstName: 'Report',
      lastName: 'Ee',
      managerId: ctx.userId,
    });
    reportId = report.id;

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: report.email, password: 'password123' })
      .expect(200);
    reportToken = loginRes.body.data.accessToken;

    // Seed a LinearIssue as if a sync had already run, assigned to the report.
    const issue = await ctx.prisma.linearIssue.create({
      data: {
        orgId: ctx.orgId,
        linearId: `linear-uuid-${Date.now()}`,
        identifier: 'ENG-1',
        title: 'Fix the flaky test',
        url: 'https://linear.app/x/issue/ENG-1',
        stateName: 'In Progress',
        stateType: 'started',
        assigneeId: reportId,
      },
    });
    issueId = issue.id;
  });

  afterAll(async () => {
    await ctx.prisma.taskUpdate.deleteMany({ where: { orgId: ctx.orgId } });
    await ctx.prisma.linearIssue.deleteMany({ where: { orgId: ctx.orgId } });
    await ctx.prisma.session.deleteMany({ where: { userId: reportId } });
    await ctx.prisma.user.deleteMany({ where: { id: reportId } });
    await ctx.cleanup();
  });

  describe('GET /task-updates/issues', () => {
    it("returns the report's own assigned issues", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/task-updates/issues')
        .set(authHeader(reportToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].identifier).toBe('ENG-1');
    });

    it('returns no issues for the owner (not the assignee)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/task-updates/issues')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /task-updates/issues/:issueId/updates', () => {
    it('lets the assignee post an update', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post(`/task-updates/issues/${issueId}/updates`)
        .set(authHeader(reportToken))
        .send({ body: 'Fixed the root cause, writing a regression test now.', status: 'in_review', progress: 70 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_review');
      expect(res.body.data.progress).toBe(70);
      taskUpdateId = res.body.data.id;
    });

    it('rejects a non-assignee posting an update', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post(`/task-updates/issues/${issueId}/updates`)
        .set(authHeader(ctx.authToken))
        .send({ body: 'I am not the assignee for this issue.', status: 'on_track' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('fails validation with a body that is too short', async () => {
      await request(ctx.app.getHttpServer())
        .post(`/task-updates/issues/${issueId}/updates`)
        .set(authHeader(reportToken))
        .send({ body: 'x', status: 'on_track' })
        .expect(400);
    });
  });

  describe('GET /task-updates/issues/:issueId', () => {
    it('lets the assignee view the issue detail + timeline', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/task-updates/issues/${issueId}`)
        .set(authHeader(reportToken))
        .expect(200);

      expect(res.body.data.issue.identifier).toBe('ENG-1');
      expect(res.body.data.updates).toHaveLength(1);
    });

    it("lets the assignee's manager (org owner) view it too", async () => {
      await request(ctx.app.getHttpServer())
        .get(`/task-updates/issues/${issueId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);
    });
  });

  describe('PATCH /task-updates/updates/:id', () => {
    it('lets the author edit their own update', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/task-updates/updates/${taskUpdateId}`)
        .set(authHeader(reportToken))
        .send({ body: 'Fixed the root cause and shipped a regression test.', status: 'done', progress: 100 })
        .expect(200);

      expect(res.body.data.status).toBe('done');
      expect(res.body.data.isEdited).toBe(true);
    });

    it("rejects the manager editing someone else's update", async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/task-updates/updates/${taskUpdateId}`)
        .set(authHeader(ctx.authToken))
        .send({ body: 'Overwriting my report\'s update.' })
        .expect(403);
    });
  });

  describe('GET /task-updates/mine', () => {
    it("returns the report's own updates", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/task-updates/mine')
        .set(authHeader(reportToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /task-updates/team', () => {
    it("returns the report's activity for their manager", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/task-updates/team')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.some((u: { id: string }) => u.id === taskUpdateId)).toBe(true);
    });
  });

  describe('GET /task-updates/users/:userId', () => {
    it('lets the manager drill into a report', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/task-updates/users/${reportId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.issues).toHaveLength(1);
    });
  });

  describe('GET /task-updates/sync/status', () => {
    it('reports Linear as not connected for a fresh test org', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/task-updates/sync/status')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.linearConnected).toBe(false);
    });
  });

  describe('POST /task-updates/sync', () => {
    it('is OWNER/ADMIN only', async () => {
      await request(ctx.app.getHttpServer())
        .post('/task-updates/sync')
        .set(authHeader(reportToken))
        .expect(403);
    });

    it('gracefully no-ops for an org with no Linear connection', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/task-updates/sync')
        .set(authHeader(ctx.authToken))
        .expect(201);

      expect(res.body.data.skipped).toBe(true);
    });
  });

  describe('DELETE /task-updates/updates/:id', () => {
    it("lets the manager soft-delete a report's update", async () => {
      const res = await request(ctx.app.getHttpServer())
        .delete(`/task-updates/updates/${taskUpdateId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 404 for an already-deleted update', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/task-updates/updates/${taskUpdateId}`)
        .set(authHeader(ctx.authToken))
        .expect(404);
    });
  });
});
