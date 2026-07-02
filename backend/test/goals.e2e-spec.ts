import * as request from 'supertest';
import { createTestApp, TestContext, authHeader } from './helpers/test.helper';

describe('Goals (e2e)', () => {
  let ctx: TestContext;
  let goalId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('POST /goals', () => {
    it('creates a goal successfully', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/goals')
        .set(authHeader(ctx.authToken))
        .send({
          title: 'Improve test coverage to 80%',
          description: 'Write unit and integration tests for all services',
          dueDate: '2024-12-31',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Improve test coverage to 80%');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.progress).toBe(0);
      goalId = res.body.data.id;
    });

    it('fails validation with short title', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/goals')
        .set(authHeader(ctx.authToken))
        .send({ title: 'Hi' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('fails without auth', async () => {
      await request(ctx.app.getHttpServer())
        .post('/goals')
        .send({ title: 'Test goal with proper length' })
        .expect(401);
    });
  });

  describe('PATCH /goals/:id', () => {
    it('updates goal details', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}`)
        .set(authHeader(ctx.authToken))
        .send({ title: 'Updated: Improve test coverage to 90%' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('90%');
    });
  });

  describe('PATCH /goals/:id/progress', () => {
    it('updates goal progress', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}/progress`)
        .set(authHeader(ctx.authToken))
        .send({ progress: 50, note: 'Halfway there!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.progress).toBe(50);
    });

    it('rejects progress out of range', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}/progress`)
        .set(authHeader(ctx.authToken))
        .send({ progress: 150 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /goals/mine', () => {
    it('returns my goals paginated', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/goals/mine')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by status', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/goals/mine?status=active')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every((g: { status: string }) => g.status === 'active')).toBe(true);
    });
  });

  describe('GET /goals/:id', () => {
    it('returns goal with history', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/goals/${goalId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(goalId);
      expect(Array.isArray(res.body.data.history)).toBe(true);
      expect(res.body.data.history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /goals/:id/complete', () => {
    it('marks goal as complete', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}/complete`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.progress).toBe(100);
      expect(res.body.data.completedAt).toBeDefined();
    });

    it('cannot complete already completed goal', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}/complete`)
        .set(authHeader(ctx.authToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /goals/:id/archive', () => {
    it('archives a completed goal', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}/archive`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('archived');
    });

    it('cannot update archived goal', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/goals/${goalId}`)
        .set(authHeader(ctx.authToken))
        .send({ title: 'Try to update archived' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /goals', () => {
    it('returns org goals', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/goals')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
