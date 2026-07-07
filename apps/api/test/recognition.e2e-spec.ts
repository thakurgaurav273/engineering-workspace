import * as request from 'supertest';
import { createTestApp, TestContext, authHeader } from './helpers/test.helper';

describe('Recognition (e2e)', () => {
  let ctx: TestContext;
  let secondUserId: string;
  let secondUserToken: string;
  let recognitionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Create a second user in the same org
    const secondUserRes = await request(ctx.app.getHttpServer())
      .post('/users')
      .set(authHeader(ctx.authToken))
      .send({
        email: `second-${Date.now()}@test.com`,
        password: 'password123',
        firstName: 'Bob',
        lastName: 'Tester',
        jobTitle: 'Engineer',
      });

    secondUserId = secondUserRes.body.data?.id;

    // Login as second user
    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: secondUserRes.body.data?.email,
        password: 'password123',
      });

    secondUserToken = loginRes.body.data?.accessToken || loginRes.body.accessToken;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('POST /recognition', () => {
    it('creates a recognition successfully', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/recognition')
        .set(authHeader(ctx.authToken))
        .send({
          recipientId: secondUserId,
          title: 'Outstanding code review',
          note: 'Bob did an exceptional job reviewing the authentication PR.',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Outstanding code review');
      expect(res.body.data.recipient.id).toBe(secondUserId);
      recognitionId = res.body.data.id;
    });

    it('prevents self-recognition', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/recognition')
        .set(authHeader(ctx.authToken))
        .send({
          recipientId: ctx.userId,
          title: 'Self recognition attempt',
          note: 'Trying to recognize myself.',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('yourself');
    });

    it('fails for user in different org', async () => {
      // Use a random non-existent user ID
      const res = await request(ctx.app.getHttpServer())
        .post('/recognition')
        .set(authHeader(ctx.authToken))
        .send({
          recipientId: 'nonexistent-user-id',
          title: 'Cross-org recognition attempt',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('fails without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post('/recognition')
        .send({ recipientId: secondUserId, title: 'No auth token here.' })
        .expect(401);
    });
  });

  describe('GET /recognition', () => {
    it('returns org recognition feed', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/recognition')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /recognition/mine', () => {
    it('returns recognitions received by me', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/recognition/mine')
        .set(authHeader(secondUserToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].recipient.id).toBe(secondUserId);
    });
  });

  describe('GET /recognition/given', () => {
    it('returns recognitions I gave', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/recognition/given')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].author.id).toBe(ctx.userId);
    });
  });

  describe('GET /recognition/user/:userId', () => {
    it('returns recognitions for a specific user', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/recognition/user/${secondUserId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 404 for user in different org', async () => {
      await request(ctx.app.getHttpServer())
        .get('/recognition/user/nonexistent-id')
        .set(authHeader(ctx.authToken))
        .expect(404);
    });
  });
});
