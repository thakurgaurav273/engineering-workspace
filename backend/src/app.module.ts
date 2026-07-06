import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestContextModule } from './kernel/context/request-context.module';
import { FeatureFlagModule } from './kernel/flags/feature-flag.module';
import { RegistryModule } from './kernel/registry/registry.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './platform/storage/storage.module';
import { PlatformModule } from './platform/platform.module';
import { EngineeringModule } from './engineering/engineering.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    RequestContextModule,
    FeatureFlagModule,
    RegistryModule,
    PrismaModule,
    StorageModule,
    PlatformModule,
    EngineeringModule,
    WorkspaceModule,
  ],
})
export class AppModule {}
