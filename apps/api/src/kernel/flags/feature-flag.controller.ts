import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { RegistryService } from '../registry/registry.service';
import { AuditService } from '../audit/audit.service';
import { FeatureFlagService } from './feature-flag.service';

class SetFlagDto {
  @IsString()
  key!: string;

  @IsBoolean()
  enabled!: boolean;
}

type Principal = { sub?: string; email?: string };

/**
 * Platform feature-flag administration. Platform SUPER_ADMIN only. Reads the effective flag
 * map (env defaults + runtime overrides) and also surfaces every flag key referenced by an
 * application manifest, so the admin can see and flip app-gating flags (e.g. `platform.admin`)
 * even when they aren't present in the env default set. Overrides are in-memory (per the
 * FeatureFlagService contract) — a persistent store arrives with the flag engine's later phase.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform/feature-flags')
export class FeatureFlagController {
  constructor(
    private readonly flags: FeatureFlagService,
    private readonly registry: RegistryService,
    private readonly platformRole: PlatformRoleService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const effective = this.flags.snapshot();
    // Union of env/override keys and every flag referenced by an application manifest.
    const keys = new Set<string>(Object.keys(effective));
    for (const app of this.registry.list()) {
      if (app.featureFlag) keys.add(app.featureFlag);
    }
    const flags = [...keys]
      .sort()
      .map((key) => ({ key, enabled: this.flags.isEnabled(key) }));
    return { flags };
  }

  @Put()
  async set(@Body() dto: SetFlagDto, @CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    this.flags.setOverride(dto.key, dto.enabled);
    await this.audit.record({
      action: 'feature-flag.set',
      actorId: user.sub,
      actorEmail: user.email,
      targetType: 'feature-flag',
      targetId: dto.key,
      metadata: { enabled: dto.enabled },
    });
    return { key: dto.key, enabled: this.flags.isEnabled(dto.key) };
  }

  @Delete(':key')
  clear(@Param('key') key: string, @CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    this.flags.clearOverride(key);
    return { key, enabled: this.flags.isEnabled(key) };
  }

  private requireSuperAdmin(user: Principal): void {
    if (!this.platformRole.isSuperAdmin(user?.email)) throw new ForbiddenException();
  }
}
