import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature-flag evaluation (roadmap T003). Phase 0 scope: process-level flags with an
 * env-provided default set (`FEATURE_FLAGS` as a JSON object of `key -> boolean`) plus
 * in-memory runtime overrides so a flag can be flipped without a redeploy. Per-scope
 * targeting (tenant/org/user) and a persistent store arrive in later phases; the
 * `isEnabled` signature is kept minimal now so those can be added additively.
 *
 * Unknown flags default to `false` - new behavior is off until explicitly enabled,
 * which is the safe default for the incremental cutovers this migration relies on.
 */
@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly defaults: Record<string, boolean>;
  private readonly overrides = new Map<string, boolean>();

  constructor(private readonly config: ConfigService) {
    this.defaults = this.loadDefaults();
  }

  private loadDefaults(): Record<string, boolean> {
    const raw = this.config.get<string>('FEATURE_FLAGS');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      this.logger.warn('FEATURE_FLAGS is not valid JSON; ignoring and defaulting all flags to false');
      return {};
    }
  }

  /** True only when the flag is explicitly enabled by an override or the env defaults. */
  isEnabled(key: string): boolean {
    const override = this.overrides.get(key);
    if (override !== undefined) return override;
    return this.defaults[key] ?? false;
  }

  /** Flip a flag at runtime (no redeploy). Wiring an admin endpoint is a later task. */
  setOverride(key: string, value: boolean): void {
    this.overrides.set(key, value);
    this.logger.log(`Feature flag "${key}" override set to ${value}`);
  }

  /** Drop a runtime override, reverting the flag to its env default. */
  clearOverride(key: string): void {
    this.overrides.delete(key);
  }

  /** The effective flag map (env defaults with runtime overrides applied). */
  snapshot(): Record<string, boolean> {
    return { ...this.defaults, ...Object.fromEntries(this.overrides) };
  }
}
