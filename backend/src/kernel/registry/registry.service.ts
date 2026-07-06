import { Injectable, Logger } from '@nestjs/common';
import { ApplicationManifest } from './application-manifest';

/**
 * In-memory application catalog (T050, DB-free variant). Apps register their manifest at
 * boot; the shell and the `/platform/applications` endpoint read from here. This is the
 * seam Billing plugs into next — a second app registering is the whole point.
 */
@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);
  private readonly manifests = new Map<string, ApplicationManifest>();

  register(manifest: ApplicationManifest): void {
    if (this.manifests.has(manifest.key)) {
      this.logger.warn(`Application "${manifest.key}" already registered; overwriting`);
    }
    this.manifests.set(manifest.key, manifest);
    this.logger.log(`Registered application "${manifest.key}" (${manifest.nav.length} nav items)`);
  }

  /** All registered apps, ordered deterministically by `order`. */
  list(): ApplicationManifest[] {
    return [...this.manifests.values()].sort((a, b) => a.order - b.order);
  }

  /** Enabled apps only — what the shell should surface. */
  listEnabled(): ApplicationManifest[] {
    return this.list().filter((m) => m.enabled);
  }

  get(key: string): ApplicationManifest | undefined {
    return this.manifests.get(key);
  }
}
