import { ConfigService } from '@nestjs/config';
import { FeatureFlagService } from './feature-flag.service';

function makeService(flags?: Record<string, boolean> | string): FeatureFlagService {
  const raw = typeof flags === 'string' ? flags : flags ? JSON.stringify(flags) : undefined;
  const config = {
    get: (key: string) => (key === 'FEATURE_FLAGS' ? raw : undefined),
  } as unknown as ConfigService;
  return new FeatureFlagService(config);
}

describe('FeatureFlagService', () => {
  it('defaults unknown flags to false', () => {
    expect(makeService().isEnabled('kernel.unknown')).toBe(false);
  });

  it('reads defaults from the FEATURE_FLAGS config', () => {
    const service = makeService({ 'kernel.rls': true, 'kernel.pdp': false });
    expect(service.isEnabled('kernel.rls')).toBe(true);
    expect(service.isEnabled('kernel.pdp')).toBe(false);
  });

  it('lets a runtime override win over the default and revert on clear', () => {
    const service = makeService({ 'kernel.registry': true });
    expect(service.isEnabled('kernel.registry')).toBe(true);

    service.setOverride('kernel.registry', false);
    expect(service.isEnabled('kernel.registry')).toBe(false);

    service.clearOverride('kernel.registry');
    expect(service.isEnabled('kernel.registry')).toBe(true);
  });

  it('ignores malformed FEATURE_FLAGS json and defaults everything to false', () => {
    const service = makeService('{ not valid json');
    expect(service.isEnabled('anything')).toBe(false);
  });

  it('snapshot merges env defaults with runtime overrides', () => {
    const service = makeService({ a: true, b: false });
    service.setOverride('b', true);
    expect(service.snapshot()).toEqual({ a: true, b: true });
  });
});
