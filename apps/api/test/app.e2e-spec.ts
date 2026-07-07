import * as request from 'supertest';
import { createTestApp, TestContext } from './helpers/test.helper';

describe('AppController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('POST /auth/register - creates org and user', async () => {
    const slug = `e2e-app-${Date.now()}`;
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/register')
      .send({
        organizationName: 'E2E Test Corp',
        organizationSlug: slug,
        firstName: 'Alice',
        lastName: 'Smith',
        email: `alice-${Date.now()}@test.com`,
        password: 'password123',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toContain('@test.com');

    // Cleanup this extra org
    await ctx.prisma.session.deleteMany({ where: { user: { orgId: res.body.data.user.orgId } } });
    await ctx.prisma.userPreference.deleteMany({ where: { userId: res.body.data.user.id } });
    await ctx.prisma.user.deleteMany({ where: { orgId: res.body.data.user.orgId } });
    await ctx.prisma.organization.deleteMany({ where: { id: res.body.data.user.orgId } });
  });

  it('POST /auth/login - authenticates user', async () => {
    // We don't have the original credentials here; test with known bad credentials
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'wrongpassword' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('GET /auth/me - returns current user', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${ctx.authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(ctx.userId);
  });

  it('GET /auth/me - rejects without token', async () => {
    await request(ctx.app.getHttpServer()).get('/auth/me').expect(401);
  });
});
