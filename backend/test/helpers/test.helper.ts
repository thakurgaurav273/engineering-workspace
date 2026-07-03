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

  // Seed test org and user
  const slug = `test-org-${Date.now()}`;
  const email = `test-${Date.now()}@example.com`;

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

  const { accessToken, user } = registerRes.body.data || registerRes.body;

  const cleanup = async () => {
    // Delete in reverse dependency order
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
