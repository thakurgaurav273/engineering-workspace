import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagService } from '../flags/feature-flag.service';
import {
  ApplicationCapabilities,
  ApplicationHealth,
  ApplicationManifest,
  ApplicationStatus,
  PlatformApplication,
} from './application-manifest';

/**
 * The Application Registry — the single catalog every application registers into via the
 * SDK. Stores {@link PlatformApplication} instances (not bare manifests) so it can drive
 * the lifecycle (boot/health/capabilities) and the metadata pages. Effective status is
 * computed here from the manifest's feature flag, so app modules no longer duplicate any
 * flag-resolution logic — they just call `register(app)`.
 */
@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);
  private readonly apps = new Map<string, PlatformApplication>();

  constructor(private readonly flags: FeatureFlagService) {}

  register(app: PlatformApplication): void {
    const { key } = app.manifest;
    if (this.apps.has(key)) {
      this.logger.warn(`Application "${key}" already registered; overwriting`);
    }
    this.apps.set(key, app);
    app.boot();
    this.logger.log(`Registered application "${key}" (${app.manifest.navigation.length} nav items)`);
  }

  /** A feature-flagged-off app is reported as DISABLED regardless of its declared status. */
  private effectiveStatus(manifest: ApplicationManifest): ApplicationStatus {
    if (manifest.featureFlag && !this.flags.isEnabled(manifest.featureFlag)) {
      return ApplicationStatus.DISABLED;
    }
    return manifest.status;
  }

  private view(app: PlatformApplication): ApplicationManifest {
    return { ...app.manifest, status: this.effectiveStatus(app.manifest) };
  }

  /** All registered apps (effective status), ordered. */
  list(): ApplicationManifest[] {
    return [...this.apps.values()].map((a) => this.view(a)).sort((a, b) => a.order - b.order);
  }

  /** What a caller should see: not DISABLED, and super-admin apps only for super admins. */
  listVisible(isSuperAdmin: boolean): ApplicationManifest[] {
    return this.list()
      .filter((m) => m.status !== ApplicationStatus.DISABLED)
      .filter((m) => !m.requiresSuperAdmin || isSuperAdmin);
  }

  get(key: string): ApplicationManifest | undefined {
    const app = this.apps.get(key);
    return app ? this.view(app) : undefined;
  }

  getApplication(key: string): PlatformApplication | undefined {
    return this.apps.get(key);
  }

  health(key: string): ApplicationHealth | undefined {
    return this.apps.get(key)?.health();
  }

  capabilities(key: string): ApplicationCapabilities | undefined {
    return this.apps.get(key)?.capabilities();
  }
}
