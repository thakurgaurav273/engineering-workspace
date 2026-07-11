jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { AuthService } from './auth.service';

function membershipRow(orgId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER', createdAt = new Date('2024-01-01')) {
  return { orgId, role, createdAt, org: { id: orgId, name: `Org ${orgId}`, slug: orgId } };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;

  const baseUser = {
    id: 'user-1',
    email: 'ada@acme.com',
    passwordHash: 'hashed',
    isActive: true,
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: null,
    defaultOrganizationId: null as string | null,
    lastActiveOrganizationId: null as string | null,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      membership: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      session: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      organization: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      organizationSwitchLog: { create: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-token'), decode: jest.fn() };
    const platformRole = { isSuperAdmin: jest.fn().mockReturnValue(false) };
    service = new AuthService(prisma, jwt, platformRole as never);

    prisma.session.create.mockResolvedValue({ id: 'session-1' });
    prisma.organizationSwitchLog.create.mockResolvedValue({});
    prisma.membership.update.mockResolvedValue({});
    prisma.membership.findMany.mockResolvedValue([]);
    prisma.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // buildAuthResponseUser's own membership lookup (role/jobTitle/department for the
    // active org) - distinct from the membership.findMany list used for org resolution.
    prisma.membership.findUnique.mockResolvedValue({
      role: 'MEMBER',
      jobTitle: null,
      department: null,
      status: MembershipStatus.ACTIVE,
      manager: null,
    });
  });

  describe('login', () => {
    it('logs in unchanged when the account has exactly one active org', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.membership.findMany.mockResolvedValue([membershipRow('org-a', 'OWNER')]);

      const result = await service.login({ email: baseUser.email, password: 'pw' } as any);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.orgId).toBe('org-a');
      expect(result.user.organizations).toEqual([
        expect.objectContaining({ id: 'org-a', role: 'OWNER' }),
      ]);
      // Logged as a fresh activation (fromOrgId: null) - matches register()'s behavior.
      expect(prisma.organizationSwitchLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fromOrgId: null, toOrgId: 'org-a' }) }),
      );
    });

    it('resolves to lastActiveOrganizationId when set and still active', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        lastActiveOrganizationId: 'org-b',
      });
      prisma.membership.findMany.mockResolvedValue([
        membershipRow('org-a', 'MEMBER', new Date('2023-01-01')),
        membershipRow('org-b', 'ADMIN', new Date('2024-06-01')),
      ]);

      const result = await service.login({ email: baseUser.email, password: 'pw' } as any);

      expect(result.user.orgId).toBe('org-b');
    });

    it('falls back to the oldest membership when no default or last-active org is set', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.membership.findMany.mockResolvedValue([
        membershipRow('org-newer', 'MEMBER', new Date('2024-06-01')),
        membershipRow('org-older', 'MEMBER', new Date('2023-01-01')),
      ]);

      const result = await service.login({ email: baseUser.email, password: 'pw' } as any);

      expect(result.user.orgId).toBe('org-older');
    });

    it('prefers defaultOrganizationId over lastActiveOrganizationId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        defaultOrganizationId: 'org-a',
        lastActiveOrganizationId: 'org-b',
      });
      prisma.membership.findMany.mockResolvedValue([
        membershipRow('org-a', 'MEMBER'),
        membershipRow('org-b', 'ADMIN'),
      ]);

      const result = await service.login({ email: baseUser.email, password: 'pw' } as any);

      expect(result.user.orgId).toBe('org-a');
    });

    it('rejects when the account has no active organization membership', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.membership.findMany.mockResolvedValue([]);

      await expect(
        service.login({ email: baseUser.email, password: 'pw' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an incorrect password before touching membership at all', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: baseUser.email, password: 'wrong' } as any),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.membership.findMany).not.toHaveBeenCalled();
    });

    it('rejects a deactivated account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false });

      await expect(
        service.login({ email: baseUser.email, password: 'pw' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it("re-mints for the refresh token's hinted org when membership is still active", async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...baseUser },
      });
      jwt.decode.mockReturnValue({ orgId: 'org-b' });
      prisma.membership.findUnique.mockResolvedValueOnce({ status: MembershipStatus.ACTIVE });
      // resolveOrgForRefresh's hint check passes, so pickActiveOrgId's fallback path
      // (user + membership list) is never reached; the next findUnique call is the
      // generateTokens-adjacent membership.role lookup.
      prisma.membership.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });

      const tokens = await service.refresh('refresh-token-value');

      expect(tokens.accessToken).toBe('signed-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-b', role: 'ADMIN' }),
        expect.anything(),
      );
    });

    it('falls back to pickActiveOrgId when the hinted org membership is gone', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...baseUser, lastActiveOrganizationId: 'org-a' },
      });
      jwt.decode.mockReturnValue({ orgId: 'org-removed' });
      // Hint check: membership for org-removed no longer exists/active.
      prisma.membership.findUnique.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, lastActiveOrganizationId: 'org-a' });
      prisma.membership.findMany.mockResolvedValue([membershipRow('org-a', 'MEMBER')]);
      // generateTokens-adjacent role lookup for the resolved org-a.
      prisma.membership.findUnique.mockResolvedValueOnce({ role: 'MEMBER' });

      const tokens = await service.refresh('refresh-token-value');

      expect(tokens.accessToken).toBe('signed-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-a' }),
        expect.anything(),
      );
    });

    it('throws when the refresh token has no matching session', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      await expect(service.refresh('bogus')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('switchOrg', () => {
    it("rejects switching into an org the user doesn't have active access to", async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.switchOrg('user-1', 'org-x', 'refresh-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects switching into an org where membership is SUSPENDED', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBER', status: MembershipStatus.SUSPENDED });

      await expect(
        service.switchOrg('user-1', 'org-x', 'refresh-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('switches org, rotates the session, and logs the switch', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: 'ADMIN', status: MembershipStatus.ACTIVE });
      prisma.session.findUnique.mockResolvedValue({ id: 'session-1', userId: 'user-1', refreshToken: 'refresh-token' });
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, lastActiveOrganizationId: 'org-a' });

      const result = await service.switchOrg('user-1', 'org-b', 'refresh-token', '1.2.3.4', 'jest-agent');

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
      expect(prisma.organizationSwitchLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            fromOrgId: 'org-a',
            toOrgId: 'org-b',
            ipAddress: '1.2.3.4',
            userAgent: 'jest-agent',
          }),
        }),
      );
      expect(result.user.orgId).toBe('org-b');
    });

    it('rejects when the presented refresh token belongs to a different user', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBER', status: MembershipStatus.ACTIVE });
      prisma.session.findUnique.mockResolvedValue({ id: 'session-1', userId: 'someone-else', refreshToken: 'refresh-token' });

      await expect(
        service.switchOrg('user-1', 'org-b', 'refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
