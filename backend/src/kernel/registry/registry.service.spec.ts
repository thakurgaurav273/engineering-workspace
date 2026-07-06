import { RegistryService } from './registry.service';
import { ApplicationManifest } from './application-manifest';

function manifest(over: Partial<ApplicationManifest>): ApplicationManifest {
  return {
    key: 'x',
    name: 'X',
    category: 'test',
    routePrefix: '/x',
    navGroup: 'X',
    order: 50,
    enabled: true,
    permissions: [],
    nav: [],
    ...over,
  };
}

describe('RegistryService', () => {
  it('registers and returns apps ordered by `order`', () => {
    const svc = new RegistryService();
    svc.register(manifest({ key: 'core', order: 90 }));
    svc.register(manifest({ key: 'engineering', order: 10 }));
    expect(svc.list().map((m) => m.key)).toEqual(['engineering', 'core']);
  });

  it('listEnabled excludes disabled apps', () => {
    const svc = new RegistryService();
    svc.register(manifest({ key: 'on', enabled: true }));
    svc.register(manifest({ key: 'off', enabled: false, order: 60 }));
    expect(svc.listEnabled().map((m) => m.key)).toEqual(['on']);
  });

  it('get returns a manifest by key, or undefined', () => {
    const svc = new RegistryService();
    svc.register(manifest({ key: 'engineering' }));
    expect(svc.get('engineering')?.key).toBe('engineering');
    expect(svc.get('missing')).toBeUndefined();
  });
});
