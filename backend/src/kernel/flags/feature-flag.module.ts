import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';

/**
 * Global feature-flag module (T003). Global so any provider can gate behavior via
 * {@link FeatureFlagService} without re-importing. Relies on the globally-registered
 * ConfigModule for env access.
 */
@Global()
@Module({
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
