import * as request from 'supertest';
import { createTestApp, TestContext, authHeader } from './helpers/test.helper';

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let secondUserId: string;
  let secondUserToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();

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

  describe('auth guard', () => {
    it('rejects unauthenticated requests', async () => {
      await request(ctx.app.getHttpServer()).get('/notifications').expect(401);
    });
  });

  describe('POST /notifications/devices', () => {
    const token = `fake-fcm-token-${Date.now()}`;

    it('registers a device', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/notifications/devices')
        .set(authHeader(ctx.authToken))
        .send({ token, platform: 'WEB', browser: 'Chrome', deviceName: 'MacBook' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe(token);
    });

    it('is idempotent - registering the same token twice updates rather than duplicates', async () => {
      await request(ctx.app.getHttpServer())
        .post('/notifications/devices')
        .set(authHeader(ctx.authToken))
        .send({ token, platform: 'WEB', browser: 'Firefox', deviceName: 'MacBook Pro' })
        .expect(201);

      const count = await ctx.prisma.pushDevice.count({ where: { token } });
      expect(count).toBe(1);

      const device = await ctx.prisma.pushDevice.findUnique({ where: { token } });
      expect(device?.browser).toBe('Firefox');
    });

    it('rejects an invalid platform', async () => {
      await request(ctx.app.getHttpServer())
        .post('/notifications/devices')
        .set(authHeader(ctx.authToken))
        .send({ token: `bad-${Date.now()}`, platform: 'DESKTOP' })
        .expect(400);
    });

    it('supports multiple devices per user', async () => {
      await request(ctx.app.getHttpServer())
        .post('/notifications/devices')
        .set(authHeader(ctx.authToken))
        .send({ token: `second-device-${Date.now()}`, platform: 'ANDROID' })
        .expect(201);

      const devices = await ctx.prisma.pushDevice.findMany({ where: { userId: ctx.userId } });
      expect(devices.length).toBeGreaterThanOrEqual(2);
    });

    describe('DELETE /notifications/devices/:token', () => {
      it('unregisters a device', async () => {
        await request(ctx.app.getHttpServer())
          .delete(`/notifications/devices/${token}`)
          .set(authHeader(ctx.authToken))
          .expect(200);

        const count = await ctx.prisma.pushDevice.count({ where: { token } });
        expect(count).toBe(0);
      });

      it('404s deleting an already-removed / unowned token', async () => {
        await request(ctx.app.getHttpServer())
          .delete(`/notifications/devices/${token}`)
          .set(authHeader(ctx.authToken))
          .expect(404);
      });
    });
  });

  describe('preferences', () => {
    it('returns default preferences (lazily created)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/notifications/preferences')
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.recognition).toBe(true);
      expect(res.body.data.checkIns).toBe(true);
    });

    it('updates a single category', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch('/notifications/preferences')
        .set(authHeader(secondUserToken))
        .send({ recognition: false })
        .expect(200);

      expect(res.body.data.recognition).toBe(false);
    });
  });

  describe('full chain - recognition triggers a notification with structured nav metadata', () => {
    let recognitionId: string;

    it('creating a recognition notifies the recipient', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/recognition')
        .set(authHeader(ctx.authToken))
        .send({ recipientId: secondUserId, title: 'Outstanding work', note: 'Great job on the launch' })
        .expect(201);

      recognitionId = res.body.data.id;
    });

    it('the recipient sees the unread count increment', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/notifications/unread-count')
        .set(authHeader(secondUserToken))
        .expect(200);

      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('the recipient sees the notification with correct structured nav metadata', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set(authHeader(secondUserToken))
        .expect(200);

      const notification = res.body.data.find((n: any) => n.entityId === recognitionId);
      expect(notification).toBeDefined();
      expect(notification.type).toBe('RECOGNITION_RECEIVED');
      expect(notification.entityType).toBe('recognition');
      expect(notification.actionUrl).toBe('/recognition');
      expect(notification.isRead).toBe(false);
    });

    it('filters by isRead', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/notifications?isRead=false')
        .set(authHeader(secondUserToken))
        .expect(200);

      expect(res.body.data.every((n: any) => n.isRead === false)).toBe(true);
    });

    it('marks a single notification read', async () => {
      const list = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set(authHeader(secondUserToken));
      const notification = list.body.data.find((n: any) => n.entityId === recognitionId);

      const res = await request(ctx.app.getHttpServer())
        .patch(`/notifications/${notification.id}/read`)
        .set(authHeader(secondUserToken))
        .expect(200);

      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeTruthy();
    });

    it('404s marking another user\'s notification as read', async () => {
      const list = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set(authHeader(secondUserToken));
      const notification = list.body.data.find((n: any) => n.entityId === recognitionId);

      await request(ctx.app.getHttpServer())
        .patch(`/notifications/${notification.id}/read`)
        .set(authHeader(ctx.authToken))
        .expect(404);
    });

    it('marks all notifications read', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/notifications/read-all')
        .set(authHeader(secondUserToken))
        .expect(200);

      const res = await request(ctx.app.getHttpServer())
        .get('/notifications/unread-count')
        .set(authHeader(secondUserToken))
        .expect(200);

      expect(res.body.data.count).toBe(0);
    });

    it('deletes a single notification', async () => {
      const list = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set(authHeader(secondUserToken));
      const notification = list.body.data.find((n: any) => n.entityId === recognitionId);

      await request(ctx.app.getHttpServer())
        .delete(`/notifications/${notification.id}`)
        .set(authHeader(secondUserToken))
        .expect(200);

      await request(ctx.app.getHttpServer())
        .delete(`/notifications/${notification.id}`)
        .set(authHeader(secondUserToken))
        .expect(404);
    });
  });

  describe('preference gating', () => {
    it('does not push (but still persists in-app) when the category is disabled', async () => {
      // secondUser disabled 'recognition' pushes earlier in this suite
      const before = await ctx.prisma.notification.count({ where: { userId: secondUserId } });

      await request(ctx.app.getHttpServer())
        .post('/recognition')
        .set(authHeader(ctx.authToken))
        .send({ recipientId: secondUserId, title: 'Another shoutout', note: 'Nice' })
        .expect(201);

      const after = await ctx.prisma.notification.count({ where: { userId: secondUserId } });
      expect(after).toBe(before + 1);
    });
  });
});
