import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';

/**
 * Global feature-flag module (T003). Global so any provider can gate behavior via
 * {@link FeatureFlagService} without re-importing. Relies on the globally-registered
 * ConfigModule for env access. Exposes a SUPER_ADMIN-only admin controller (reads the
 * effective flag map + app-manifest flags, flips runtime overrides).
 */
@Global()
@Module({
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
