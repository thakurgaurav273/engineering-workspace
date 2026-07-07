import * as request from 'supertest';
import { createTestApp, TestContext, authHeader } from './helpers/test.helper';

describe('Reviews (e2e)', () => {
  let ctx: TestContext;
  let reviewId: string;

  // Get the most recent Monday
  function getLastMonday(): string {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().split('T')[0];
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('POST /reviews', () => {
    it('creates a self review successfully', async () => {
      const weekStart = getLastMonday();
      const res = await request(ctx.app.getHttpServer())
        .post('/reviews')
        .set(authHeader(ctx.authToken))
        .send({
          type: 'self',
          weekStart,
          wins: 'Completed the authentication module ahead of schedule.',
          challenges: 'Performance optimization took longer than expected.',
          learning: 'Learned about JWT refresh token rotation patterns.',
          rating: 4,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('self');
      expect(res.body.data.status).toBe('draft');
      reviewId = res.body.data.id;
    });

    it('fails when weekStart is not a Monday', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/reviews')
        .set(authHeader(ctx.authToken))
        .send({
          type: 'self',
          weekStart: '2024-01-09', // Tuesday
          wins: 'Test wins content here for this review',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Monday');
    });

    it('fails with duplicate review for same period', async () => {
      const weekStart = getLastMonday();
      const res = await request(ctx.app.getHttpServer())
        .post('/reviews')
        .set(authHeader(ctx.authToken))
        .send({ type: 'self', weekStart })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('fails without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post('/reviews')
        .send({ type: 'self', weekStart: getLastMonday() })
        .expect(401);
    });
  });

  describe('PATCH /reviews/:id', () => {
    it('updates a draft review', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set(authHeader(ctx.authToken))
        .send({ rating: 5, wins: 'Updated wins section with more details about accomplishments.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
    });
  });

  describe('GET /reviews/mine', () => {
    it('returns reviews as reviewee', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/reviews/mine')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /reviews/given', () => {
    it('returns reviews I authored', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/reviews/given')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /reviews/pending', () => {
    it('returns pending reviews', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/reviews/pending')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /reviews/:id', () => {
    it('returns single review', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/reviews/${reviewId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(reviewId);
    });
  });

  describe('PATCH /reviews/:id/submit', () => {
    it('submits a review and locks it', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/reviews/${reviewId}/submit`)
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('submitted');
      expect(res.body.data.submittedAt).toBeDefined();
    });

    it('cannot edit after submission', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set(authHeader(ctx.authToken))
        .send({ rating: 3 })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('cannot re-submit an already submitted review', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/reviews/${reviewId}/submit`)
        .set(authHeader(ctx.authToken))
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
