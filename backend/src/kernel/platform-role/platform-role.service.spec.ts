import { ConfigService } from '@nestjs/config';
import { PlatformRoleService } from './platform-role.service';

function make(list?: string): PlatformRoleService {
  const config = {
    get: (key: string) => (key === 'PLATFORM_SUPER_ADMINS' ? list : undefined),
  } as unknown as ConfigService;
  return new PlatformRoleService(config);
}

describe('PlatformRoleService', () => {
  it('recognizes an allowlisted email, case-insensitively', () => {
    const svc = make('root@grovyn.io, ops@grovyn.io');
    expect(svc.isSuperAdmin('ROOT@grovyn.io')).toBe(true);
    expect(svc.platformRole('ops@grovyn.io')).toBe('SUPER_ADMIN');
  });

  it('denies non-listed users and empty input', () => {
    const svc = make('root@grovyn.io');
    expect(svc.isSuperAdmin('owner@acme.com')).toBe(false);
    expect(svc.isSuperAdmin(undefined)).toBe(false);
    expect(svc.platformRole(null)).toBeNull();
  });

  it('treats an unset allowlist as no super admins', () => {
    expect(make(undefined).isSuperAdmin('anyone@grovyn.io')).toBe(false);
  });
});
