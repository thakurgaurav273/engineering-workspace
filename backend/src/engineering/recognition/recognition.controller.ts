import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RecognitionService } from './recognition.service';
import { CreateRecognitionDto } from './dto/create-recognition.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('recognition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recognition')
export class RecognitionController {
  constructor(private recognitionService: RecognitionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a recognition' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRecognitionDto) {
    return this.recognitionService.create(user.sub, user.orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Org recognition feed (most recent first)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.recognitionService.findAll(user.orgId, pagination);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Recognitions received by me' })
  findMine(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.recognitionService.findMine(user.sub, user.orgId, pagination);
  }

  @Get('given')
  @ApiOperation({ summary: 'Recognitions I gave' })
  findGiven(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.recognitionService.findGiven(user.sub, user.orgId, pagination);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Recognitions received by a specific user (org-scoped)' })
  findByUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.recognitionService.findByUser(userId, user.orgId, pagination);
  }
}
