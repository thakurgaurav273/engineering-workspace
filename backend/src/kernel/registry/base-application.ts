import {
  ApplicationCapabilities,
  ApplicationHealth,
  ApplicationManifest,
  PlatformApplication,
} from './application-manifest';

/**
 * Base implementation of the application lifecycle. Every app extends this and supplies a
 * manifest; the defaults derive everything else. Apps override `boot`/`health` later when
 * they have real logic — for now these are uniform, no-business-logic defaults so all
 * three applications implement the exact same interface with no special cases.
 */
export abstract class BaseApplication implements PlatformApplication {
  abstract readonly manifest: ApplicationManifest;

  register(): ApplicationManifest {
    return this.manifest;
  }

  boot(): void {
    // No-op. Hook for future boot-time wiring (subscriptions, warmups).
  }

  health(): ApplicationHealth {
    return { status: 'ok', application: this.manifest.key };
  }

  capabilities(): ApplicationCapabilities {
    const m = this.manifest;
    return {
      key: m.key,
      version: m.version,
      status: m.status,
      navigation: m.navigation,
      permissions: m.permissions,
      dependencies: m.dependencies,
      events: m.events,
      aiTools: m.aiTools,
    };
  }
}
