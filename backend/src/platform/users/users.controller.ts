import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List org users' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListUsersDto) {
    const { search, isActive, ...pagination } = query;
    return this.usersService.findAll(
      user.orgId,
      pagination,
      search,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.findOne(id, user.orgId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a new user in the org' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, user.orgId, dto, user.sub, user.role);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: "Change a user's role" })
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(id, user.orgId, dto.role, user.sub, user.role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Activate or deactivate a user' })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(id, user.orgId, dto.isActive, user.sub, user.role);
  }

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset a user's password and email them a new one" })
  resetPassword(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.resetPassword(id, user.orgId, user.sub, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a user' })
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.deactivate(id, user.orgId, user.sub, user.role);
  }

  @Patch(':id/avatar')
  @ApiOperation({ summary: 'Update avatar URL' })
  updateAvatar(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { avatarUrl: string },
  ) {
    return this.usersService.updateAvatar(id, user.orgId, body.avatarUrl, user.sub);
  }

  @Get(':id/preference')
  @ApiOperation({ summary: 'Get user preferences' })
  getPreference(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.getPreference(id, user.orgId, user.sub);
  }

  @Patch(':id/preference')
  @ApiOperation({ summary: 'Update user preferences' })
  updatePreference(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    dto: {
      timezone?: string;
      emailNotifications?: boolean;
      weeklyDigest?: boolean;
      theme?: string;
      dailyCheckinReminder?: boolean;
      weeklyReviewReminder?: boolean;
      autoShareRecognition?: boolean;
      showMenteeSuggestions?: boolean;
      notifyNewRecognition?: boolean;
      notifyCheckInBlockers?: boolean;
      notifyReviewRequests?: boolean;
    },
  ) {
    return this.usersService.updatePreference(id, user.orgId, user.sub, dto);
  }
}
