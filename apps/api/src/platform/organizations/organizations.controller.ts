import { Controller, Get, Patch, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/create-organization.dto';
import { AvatarUploadUrlDto } from '@/platform/users/dto/avatar-upload.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current organization' })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.orgsService.findMine(user.orgId);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update organization details (owner only)' })
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateOrganizationDto) {
    return this.orgsService.update(user.orgId, dto);
  }

  @Post('me/logo/upload-url')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a short-lived presigned URL to upload a new org logo to R2 (owner only)' })
  createLogoUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: AvatarUploadUrlDto) {
    return this.orgsService.createLogoUploadUrl(user.orgId, dto);
  }
}
