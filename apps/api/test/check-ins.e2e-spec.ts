import * as request from 'supertest';
import { createTestApp, TestContext, authHeader } from './helpers/test.helper';

describe('CheckIns (e2e)', () => {
  let ctx: TestContext;
  let checkInId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('POST /check-ins', () => {
    it('creates a check-in successfully', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/check-ins')
        .set(authHeader(ctx.authToken))
        .send({
          status: 'on_track',
          summary: 'Had a productive day working on the authentication module and unit tests.',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('on_track');
      expect(res.body.data.user).toBeDefined();
      checkInId = res.body.data.id;
    });

    it('prevents duplicate check-in on the same day', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/check-ins')
        .set(authHeader(ctx.authToken))
        .send({
          status: 'blocked',
          summary: 'This is a duplicate check-in attempt that should fail.',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already checked in');
    });

    it('fails validation when summary is too short', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/check-ins')
        .set(authHeader(ctx.authToken))
        .send({
          status: 'on_track',
          summary: 'Short',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('fails with invalid status enum', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/check-ins')
        .set(authHeader(ctx.authToken))
        .send({
          status: 'invalid_status',
          summary: 'This should fail because status is invalid.',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('fails without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post('/check-ins')
        .send({ status: 'on_track', summary: 'No auth token provided here.' })
        .expect(401);
    });
  });

  describe('PATCH /check-ins/:id', () => {
    it("updates today's check-in", async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/check-ins/${checkInId}`)
        .set(authHeader(ctx.authToken))
        .send({ status: 'completed', summary: 'Updated the summary after completing all tasks today.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('returns 404 for non-existent check-in', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/check-ins/nonexistent-id')
        .set(authHeader(ctx.authToken))
        .send({ status: 'completed' })
        .expect(404);
    });
  });

  describe('GET /check-ins/mine', () => {
    it('returns paginated check-ins for current user', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/check-ins/mine')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /check-ins/today', () => {
    it("returns today's org check-ins", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/check-ins/today')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /check-ins/stats', () => {
    it('returns check-in stats', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/check-ins/stats')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.checkInRate).toBeDefined();
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /check-ins', () => {
    it('returns org-level check-ins (paginated)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/check-ins')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('filters by userId', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/check-ins?userId=${ctx.userId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every((c: { user: { id: string } }) => c.user.id === ctx.userId)).toBe(true);
    });
  });

  describe('DELETE /check-ins/:id', () => {
    it("deletes today's check-in", async () => {
      const res = await request(ctx.app.getHttpServer())
        .delete(`/check-ins/${checkInId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 404 after deletion', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/check-ins/${checkInId}`)
        .set(authHeader(ctx.authToken))
        .expect(404);
    });
  });
});
