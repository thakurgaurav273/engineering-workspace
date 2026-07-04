import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  authToken: string;
  userId: string;
  orgId: string;
  cleanup: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();

  const prisma = moduleFixture.get<PrismaService>(PrismaService);

  // Seed test org and user. Date.now() alone collides when parallel Jest workers hit
  // this within the same millisecond (each e2e spec file boots its own app via this
  // helper); the random suffix keeps orgs/emails unique across concurrent test files.
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const slug = `test-org-${unique}`;
  const email = `test-${unique}@example.com`;

  const registerRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      organizationName: 'Test Organization',
      organizationSlug: slug,
      firstName: 'Test',
      lastName: 'User',
      email,
      password: 'password123',
    });

  if (!registerRes.body?.success) {
    throw new Error(
      `createTestApp() setup failed: POST /auth/register returned ${registerRes.status}: ${JSON.stringify(registerRes.body)}`,
    );
  }

  const { accessToken, user } = registerRes.body.data;

  const cleanup = async () => {
    // Delete in reverse dependency order
    await prisma.workspaceItem.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.invitation.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.notification.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.pushDevice.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.notificationPreference.deleteMany({ where: { user: { orgId: user?.orgId } } });
    await prisma.recognition.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.weeklyReview.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.goalHistory.deleteMany({
      where: { goal: { orgId: user?.orgId } },
    });
    await prisma.goal.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.checkIn.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.session.deleteMany({ where: { user: { orgId: user?.orgId } } });
    await prisma.userPreference.deleteMany({
      where: { user: { orgId: user?.orgId } },
    });
    await prisma.user.deleteMany({ where: { orgId: user?.orgId } });
    await prisma.organization.deleteMany({ where: { id: user?.orgId } });
    await app.close();
  };

  return {
    app,
    prisma,
    authToken: accessToken,
    userId: user?.id,
    orgId: user?.orgId,
    cleanup,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
