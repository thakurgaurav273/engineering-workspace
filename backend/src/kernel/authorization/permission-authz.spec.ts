import { Controller, Get, Post, Logger } from '@nestjs/common';
import { Reflector, MetadataScanner } from '@nestjs/core';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  RequirePermission,
  RequireAllPermissions,
  PERMISSION_KEY,
  PermissionRequirement,
} from './require-permission.decorator';
import { PermissionResolver } from './permission-resolver.service';
import { PermissionMetadataDiscovery } from './permission-metadata.discovery';
import { PermissionMappingValidator } from './permission-mapping.validator';
import { ShadowAuthService } from './shadow-auth.service';
import { Pdp } from './pdp.service';

describe('@RequirePermission metadata', () => {
  class Sample {
    @RequirePermission('engineering:goal:write')
    write() {}
    @RequireAllPermissions('a', 'b')
    both() {}
  }
  const reflector = new Reflector();

  it('attaches an any-mode requirement', () => {
    expect(reflector.get<PermissionRequirement>(PERMISSION_KEY, Sample.prototype.write)).toEqual({
      permissions: ['engineering:goal:write'],
      mode: 'any',
    });
  });
  it('attaches an all-mode requirement', () => {
    expect(reflector.get<PermissionRequirement>(PERMISSION_KEY, Sample.prototype.both)?.mode).toBe('all');
  });
});

describe('PermissionResolver', () => {
  const pdp = {
    checkPermission: async (_p: unknown, perm: string) => ({ allow: perm === 'a', reason: '' }),
  } as unknown as Pdp;
  const resolver = new PermissionResolver(pdp);

  it('any-mode allows when one permission is granted', async () => {
    expect((await resolver.resolve({}, { permissions: ['a', 'b'], mode: 'any' })).allow).toBe(true);
  });
  it('all-mode denies when one permission is missing', async () => {
    expect((await resolver.resolve({}, { permissions: ['a', 'b'], mode: 'all' })).allow).toBe(false);
  });
  it('allows when nothing is required', async () => {
    expect((await resolver.resolve({}, { permissions: [], mode: 'any' })).allow).toBe(true);
  });
});

describe('PermissionMetadataDiscovery', () => {
  @Controller('goals')
  class TestController {
    @Get(':id')
    @RequirePermission('engineering:goal:read')
    findOne() {}

    @Post()
    @Roles('OWNER', 'ADMIN')
    create() {}
  }

  const discovery = {
    getControllers: () => [{ instance: new TestController(), metatype: TestController }],
  };
  const service = new PermissionMetadataDiscovery(
    discovery as never,
    new MetadataScanner(),
    new Reflector(),
  );

  it('discovers routes with roles and permissions', () => {
    const endpoints = service.discoverEndpoints();
    const findOne = endpoints.find((e) => e.handler === 'findOne');
    const create = endpoints.find((e) => e.handler === 'create');
    expect(findOne?.permissions).toEqual(['engineering:goal:read']);
    expect(findOne?.route).toBe('/goals/:id');
    expect(create?.roles).toEqual(['OWNER', 'ADMIN']);
  });

  it('flags @Roles endpoints missing @RequirePermission', () => {
    const missing = service.endpointsMissingPermissions();
    expect(missing.map((e) => e.handler)).toEqual(['create']);
  });
});

describe('PermissionMappingValidator', () => {
  it('warns for each unmapped endpoint, without throwing', () => {
    const discovery = {
      endpointsMissingPermissions: () => [
        { method: 'POST', route: '/goals', controller: 'C', handler: 'create', roles: ['OWNER'], permissions: [], application: 'goals' },
      ],
    } as unknown as PermissionMetadataDiscovery;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    new PermissionMappingValidator(discovery).onApplicationBootstrap();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('ShadowAuthService.evaluatePermission', () => {
  function make(resolveAllow: boolean, flagOn = true) {
    const resolver = { resolve: async () => ({ allow: resolveAllow, reason: 'x' }) } as unknown as PermissionResolver;
    const flags = { isEnabled: () => flagOn };
    const context = { correlationId: 'c' };
    return new ShadowAuthService({} as Pdp, resolver, flags as never, context as never);
  }
  const requirement: PermissionRequirement = { permissions: ['a'], mode: 'any' };
  const base = { principal: {}, route: '/x', handler: 'h', requiredRoles: [] as string[] };

  it('logs when the permission decision diverges from the guard', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await make(false).evaluatePermission({ ...base, guardAllow: true, requirement });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('is silent on parity', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await make(true).evaluatePermission({ ...base, guardAllow: true, requirement });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('is a no-op when the shadow flag is off', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await make(false, false).evaluatePermission({ ...base, guardAllow: true, requirement });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
