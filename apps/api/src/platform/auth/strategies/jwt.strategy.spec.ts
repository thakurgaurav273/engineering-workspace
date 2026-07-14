import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';

// The acting-as-org override is the security boundary for cross-tenant admin: only a platform
// super-admin may rescope a request to another org, and only to an org that exists.
describe('JwtStrategy acting-as-org override', () => {
  const payload = { sub: 'user-1', email: 'op@grovyn.in', orgId: 'org-home' };
  const activeMembership = { role: 'ADMIN', status: 'ACTIVE', org: { status: 'ACTIVE' } };

  function make(opts: { superAdmin: boolean; targetExists?: boolean }) {
    const prisma = {
      membership: { findUnique: jest.fn().mockResolvedValue(activeMembership) },
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.targetExists === false ? null : { id: 'org-target' }),
      },
    };
    const platformRole = { isSuperAdmin: jest.fn().mockReturnValue(opts.superAdmin) };
    const strategy = new JwtStrategy(prisma as never, platformRole as never);
    return { strategy, prisma };
  }

  const req = (headers: Record<string, string> = {}) => ({ headers }) as unknown as Request;

  it('returns the home org and membership role when no header is sent', async () => {
    const { strategy } = make({ superAdmin: false });
    await expect(strategy.validate(req(), payload)).resolves.toEqual({
      sub: 'user-1',
      email: 'op@grovyn.in',
      orgId: 'org-home',
      role: 'ADMIN',
    });
  });

  it('ignores a header that names the caller’s own org', async () => {
    const { strategy } = make({ superAdmin: false });
    const result = await strategy.validate(req({ 'x-org-id': 'org-home' }), payload);
    expect(result.orgId).toBe('org-home');
    expect(result).not.toHaveProperty('actingAsOrgId');
  });

  it('forbids a non-super-admin from overriding to another org', async () => {
    const { strategy } = make({ superAdmin: false });
    await expect(strategy.validate(req({ 'x-org-id': 'org-target' }), payload)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('forbids a super-admin from overriding to an unknown org', async () => {
    const { strategy } = make({ superAdmin: true, targetExists: false });
    await expect(strategy.validate(req({ 'x-org-id': 'org-target' }), payload)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rescopes a super-admin to the target org with an elevated acting role', async () => {
    const { strategy } = make({ superAdmin: true });
    const result = await strategy.validate(req({ 'x-org-id': 'org-target' }), payload);
    expect(result).toEqual({
      sub: 'user-1',
      email: 'op@grovyn.in',
      orgId: 'org-target',
      role: 'OWNER',
      homeOrgId: 'org-home',
      actingAsOrgId: 'org-target',
    });
  });

  it('still rejects an inactive home membership before any override', async () => {
    const { strategy, prisma } = make({ superAdmin: true });
    prisma.membership.findUnique.mockResolvedValue({ ...activeMembership, status: 'SUSPENDED' });
    await expect(strategy.validate(req({ 'x-org-id': 'org-target' }), payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
