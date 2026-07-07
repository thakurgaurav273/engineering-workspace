import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new review (self or manager)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, user.orgId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get reviews where I am the reviewee' })
  findMine(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.reviewsService.findMine(user.sub, user.orgId, pagination);
  }

  @Get('given')
  @ApiOperation({ summary: 'Get reviews I authored (manager view)' })
  findGiven(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.reviewsService.findGiven(user.sub, user.orgId, pagination);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get reviews I still need to complete' })
  findPending(@CurrentUser() user: JwtPayload) {
    return this.reviewsService.findPending(user.sub, user.orgId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all reviews for a user (manager access)' })
  findByUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.findByUser(userId, user.orgId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewsService.findOne(id, user.orgId, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a review (draft only)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(id, user.sub, user.orgId, dto);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit a review (locks it permanently)' })
  submit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reviewsService.submit(id, user.sub, user.orgId);
  }
}
