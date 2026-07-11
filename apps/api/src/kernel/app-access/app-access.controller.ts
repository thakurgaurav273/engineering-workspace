import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { AuditService } from '../audit/audit.service';
import { AppAccessService } from './app-access.service';
import { AccessMatrixQueryDto, SetAppAccessDto } from './dto/app-access.dto';

type Principal = { sub?: string; email?: string; orgId?: string };

/**
 * Per-user application access management. Platform SUPER_ADMIN only - this is a platform-level
 * control (matching PLATFORM_SUPER_ADMINS), not an organization capability. @RequirePermission adds
 * shadow-mode audit coverage, consistent with the installation controller.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform/app-access')
export class AppAccessController {
  constructor(
    private readonly appAccess: AppAccessService,
    private readonly platformRole: PlatformRoleService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission('platform:user:manage')
  async matrix(@Query() query: AccessMatrixQueryDto, @CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const orgId = query.orgId ?? user.orgId;
    if (!orgId) throw new ForbiddenException('No organization in scope');
    return this.appAccess.accessMatrix(orgId);
  }

  @Put()
  @RequirePermission('platform:user:manage')
  async set(@Body() dto: SetAppAccessDto, @CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const orgId = dto.orgId ?? user.orgId;
    if (!orgId) throw new ForbiddenException('No organization in scope');
    const result = await this.appAccess.setAccess({
      orgId,
      userId: dto.userId,
      applicationKey: dto.applicationKey,
      granted: dto.granted,
      grantedById: user.sub,
    });
    await this.audit.record({
      action: dto.granted ? 'app-access.grant' : 'app-access.revoke',
      actorId: user.sub,
      actorEmail: user.email,
      targetType: 'user',
      targetId: dto.userId,
      orgId,
      metadata: { applicationKey: dto.applicationKey, granted: dto.granted },
    });
    return result;
  }

  private requireSuperAdmin(user: Principal): void {
    if (!this.platformRole.isSuperAdmin(user?.email)) throw new ForbiddenException();
  }
}
