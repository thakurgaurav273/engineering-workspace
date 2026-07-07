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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { UpdateCheckInDto } from './dto/update-check-in.dto';
import { ListCheckInsDto } from './dto/list-check-ins.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('check-ins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('check-ins')
export class CheckInsController {
  constructor(private checkInsService: CheckInsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a daily check-in' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCheckInDto) {
    return this.checkInsService.create(user.sub, user.orgId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get my check-ins' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListCheckInsDto) {
    const { from, to, ...pagination } = query;
    return this.checkInsService.findMine(user.sub, user.orgId, pagination, from, to);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's org check-ins" })
  findToday(@CurrentUser() user: JwtPayload) {
    return this.checkInsService.findToday(user.orgId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get check-in stats for org' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.checkInsService.getStats(user.orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Get org check-ins' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListCheckInsDto) {
    const { userId, from, to, ...pagination } = query;
    return this.checkInsService.findAll(user.orgId, pagination, userId, from, to);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update today's check-in" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCheckInDto,
  ) {
    return this.checkInsService.update(id, user.sub, user.orgId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Delete today's check-in" })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.checkInsService.remove(id, user.sub, user.orgId);
  }
}
