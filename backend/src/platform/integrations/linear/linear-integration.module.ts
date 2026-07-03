import { Module } from '@nestjs/common';
import { LinearIntegrationController } from './linear-integration.controller';
import { LinearIntegrationService } from './linear-integration.service';

@Module({
  controllers: [LinearIntegrationController],
  providers: [LinearIntegrationService],
  exports: [LinearIntegrationService],
})
export class LinearIntegrationModule {}
