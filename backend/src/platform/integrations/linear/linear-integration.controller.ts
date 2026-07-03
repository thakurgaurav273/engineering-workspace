import { Controller, Get, Post, Delete, Body, Param, NotFoundException, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LinearIntegrationService } from './linear-integration.service';
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
  constructor(
    private linearService: LinearIntegrationService,
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
  connect(@CurrentUser() user: JwtPayload, @Body() dto: ConnectLinearDto) {
    return this.linearService.connect(user.orgId, dto.apiKey);
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
