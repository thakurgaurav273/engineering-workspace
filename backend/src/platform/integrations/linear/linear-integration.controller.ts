import { Controller, Get, Post, Delete, Body, Param, NotFoundException, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LinearIntegrationService } from './linear-integration.service';
import { LinearSyncService } from './linear-sync.service';
import { ConnectLinearDto } from './dto/connect-linear.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/linear')
export class LinearIntegrationController {
  private readonly logger = new Logger(LinearIntegrationController.name);

  constructor(
    private linearService: LinearIntegrationService,
    private linearSync: LinearSyncService,
    private prisma: PrismaService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check whether this org has Linear connected' })
  getStatus(@CurrentUser() user: JwtPayload) {
    return this.linearService.getStatus(user.orgId);
  }

  @Post('connect')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Connect this org to Linear via a personal API key' })
  async connect(@CurrentUser() user: JwtPayload, @Body() dto: ConnectLinearDto) {
    const result = await this.linearService.connect(user.orgId, dto.apiKey);
    // Fire-and-forget: the connect response shouldn't block on a full workspace sync.
    this.linearSync
      .syncAssignedIssues(user.orgId)
      .catch((err) => this.logger.error(`Post-connect Linear sync failed for org ${user.orgId}`, err));
    return result;
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Linear from this org' })
  disconnect(@CurrentUser() user: JwtPayload) {
    return this.linearService.disconnect(user.orgId);
  }

  @Get('users/:userId/issues')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: "Get a teammate's detailed Linear ticket activity" })
  async getUserActivity(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, orgId: user.orgId },
      select: { email: true },
    });
    if (!target) throw new NotFoundException('User not found');

    return this.linearService.getUserActivity(user.orgId, target.email);
  }
}
