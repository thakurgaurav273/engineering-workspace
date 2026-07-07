import { Injectable } from '@nestjs/common';
import { RegistryService } from '../registry/registry.service';

/**
 * Permission catalog discovered automatically from application manifests. Each app
 * declares its permissions (`app:resource:action`) in its manifest's `permissions` field;
 * this aggregates them across all registered applications. No hardcoding — a new app's
 * permissions appear here the moment it registers.
 */
@Injectable()
export class PermissionRegistry {
  constructor(private readonly registry: RegistryService) {}

  /** All declared permission keys across applications, de-duped and sorted. */
  list(): string[] {
    const set = new Set<string>();
    for (const app of this.registry.list()) {
      for (const permission of app.permissions) set.add(permission);
    }
    return [...set].sort();
  }

  /** Permissions grouped by owning application key. */
  byApplication(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const app of this.registry.list()) {
      if (app.permissions.length) out[app.key] = [...app.permissions].sort();
    }
    return out;
  }

  has(permission: string): boolean {
    return this.list().includes(permission);
  }

  count(): number {
    return this.list().length;
  }
}
