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

type Principal = { sub?: string; email?: string; orgId?: string; role?: string };

/**
 * Per-user application access management. A platform SUPER_ADMIN may manage any org; an org OWNER or
 * ADMIN may manage per-user access within their own active org only (they can never target another
 * org's id via the DTO/query). This makes each organization self-sufficient while keeping super-admin
 * as a cross-org override. @RequirePermission adds shadow-mode audit coverage.
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
    const orgId = query.orgId ?? user.orgId;
    if (!orgId) throw new ForbiddenException('No organization in scope');
    this.authorizeOrg(user, orgId);
    return this.appAccess.accessMatrix(orgId);
  }

  @Put()
  @RequirePermission('platform:user:manage')
  async set(@Body() dto: SetAppAccessDto, @CurrentUser() user: Principal) {
    const orgId = dto.orgId ?? user.orgId;
    if (!orgId) throw new ForbiddenException('No organization in scope');
    this.authorizeOrg(user, orgId);
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

  /**
   * A super-admin may manage any org; otherwise the caller must be acting inside their own active
   * org (`user.orgId === orgId`, freshly resolved from Membership by the JWT strategy) and hold an
   * OWNER or ADMIN role there. This forbids a non-super-admin from targeting another org via the DTO.
   */
  private authorizeOrg(user: Principal, orgId: string): void {
    if (this.platformRole.isSuperAdmin(user?.email)) return;
    const isOrgManager =
      user?.orgId === orgId && (user?.role === 'OWNER' || user?.role === 'ADMIN');
    if (!isOrgManager) throw new ForbiddenException();
  }
}
