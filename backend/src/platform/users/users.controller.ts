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
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';

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
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
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
    return this.usersService.update(id, user.orgId, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a user' })
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.deactivate(id, user.orgId, user.sub);
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
    return this.usersService.getPreference(id, user.orgId);
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
    },
  ) {
    return this.usersService.updatePreference(id, user.orgId, dto);
  }
}
