import { PermissionRegistry } from './permission-registry.service';
import { RegistryService } from '../registry/registry.service';
import { ApplicationManifest } from '../registry/application-manifest';

function registryWith(apps: Partial<ApplicationManifest>[]): RegistryService {
  const list = apps.map((a) => ({ key: a.key, permissions: a.permissions ?? [] }));
  return { list: () => list } as unknown as RegistryService;
}

describe('PermissionRegistry', () => {
  it('discovers and de-dupes permissions across applications', () => {
    const reg = new PermissionRegistry(
      registryWith([
        { key: 'engineering', permissions: ['engineering:goal:read', 'engineering:goal:write'] },
        { key: 'business-operations', permissions: ['business-operations:invoice:read', 'engineering:goal:read'] },
      ]),
    );
    expect(reg.count()).toBe(3);
    expect(reg.has('business-operations:invoice:read')).toBe(true);
    expect(reg.has('unknown')).toBe(false);
  });

  it('groups permissions by application', () => {
    const reg = new PermissionRegistry(
      registryWith([{ key: 'engineering', permissions: ['engineering:goal:read'] }]),
    );
    expect(reg.byApplication()).toEqual({ engineering: ['engineering:goal:read'] });
  });
});
