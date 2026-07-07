import { ConfigService } from '@nestjs/config';
import { FeatureFlagService } from '../flags/feature-flag.service';
import { RegistryService } from './registry.service';
import { BaseApplication } from './base-application';
import { ApplicationManifest, ApplicationStatus } from './application-manifest';

function manifest(over: Partial<ApplicationManifest>): ApplicationManifest {
  return {
    id: over.key ?? 'x',
    key: 'x',
    name: 'X',
    description: '',
    icon: 'AppWindow',
    category: 'operations',
    order: 50,
    routePrefix: '/x',
    version: '1.0.0',
    owner: 'Test',
    status: ApplicationStatus.ACTIVE,
    navigation: [],
    permissions: [],
    dependencies: [],
    events: [],
    aiTools: [],
    ...over,
  };
}

function app(over: Partial<ApplicationManifest>): BaseApplication {
  const m = manifest(over);
  return new (class extends BaseApplication {
    readonly manifest = m;
  })();
}

function registry(flags?: Record<string, boolean>): RegistryService {
  const config = {
    get: (key: string) =>
      key === 'FEATURE_FLAGS' && flags ? JSON.stringify(flags) : undefined,
  } as unknown as ConfigService;
  return new RegistryService(new FeatureFlagService(config));
}

describe('RegistryService', () => {
  it('registers apps and orders them by `order`', () => {
    const svc = registry();
    svc.register(app({ key: 'core', order: 90 }));
    svc.register(app({ key: 'engineering', order: 10 }));
    expect(svc.list().map((m) => m.key)).toEqual(['engineering', 'core']);
  });

  it('reports a flag-gated-off app as DISABLED and hides it from listVisible', () => {
    const svc = registry({ 'x.flag': false });
    svc.register(app({ key: 'gated', featureFlag: 'x.flag' }));
    expect(svc.get('gated')?.status).toBe(ApplicationStatus.DISABLED);
    expect(svc.listVisible(false).map((m) => m.key)).not.toContain('gated');
  });

  it('shows super-admin apps only to super admins', () => {
    const svc = registry();
    svc.register(app({ key: 'admin', requiresSuperAdmin: true }));
    expect(svc.listVisible(false).map((m) => m.key)).not.toContain('admin');
    expect(svc.listVisible(true).map((m) => m.key)).toContain('admin');
  });

  it('exposes lifecycle health and capabilities per app', () => {
    const svc = registry();
    svc.register(app({ key: 'engineering', version: '2.1.0' }));
    expect(svc.health('engineering')).toEqual({ status: 'ok', application: 'engineering' });
    expect(svc.capabilities('engineering')?.version).toBe('2.1.0');
  });
});
