import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ReviewStatus, ReviewType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private readonly reviewSelect = {
    id: true,
    type: true,
    weekStart: true,
    wins: true,
    challenges: true,
    learning: true,
    feedback: true,
    rating: true,
    status: true,
    submittedAt: true,
    createdAt: true,
    updatedAt: true,
    orgId: true,
    revieweeId: true,
    reviewerId: true,
    reviewee: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
    },
    reviewer: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
    },
  };

  private getMondayOfWeek(dateStr: string): Date {
    const date = new Date(dateStr);
    const day = date.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    date.setUTCDate(date.getUTCDate() + diff);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private isMonday(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date.getUTCDay() === 1;
  }

  async create(userId: string, orgId: string, dto: CreateReviewDto) {
    if (!this.isMonday(dto.weekStart)) {
      throw new BadRequestException('weekStart must be a Monday');
    }

    const weekStart = new Date(dto.weekStart);
    weekStart.setUTCHours(0, 0, 0, 0);

    let revieweeId: string;
    let reviewerId: string;

    if (dto.type === ReviewType.self) {
      revieweeId = userId;
      reviewerId = userId;
    } else {
      // manager review
      if (!dto.revieweeId) {
        throw new BadRequestException('revieweeId is required for manager reviews');
      }
      revieweeId = dto.revieweeId;
      reviewerId = userId;

      // Verify reviewee is in same org
      const reviewee = await this.prisma.user.findFirst({
        where: { id: revieweeId, orgId },
      });
      if (!reviewee) throw new NotFoundException('Reviewee not found in this organization');
    }

    const existing = await this.prisma.weeklyReview.findUnique({
      where: {
        revieweeId_reviewerId_type_weekStart: {
          revieweeId,
          reviewerId,
          type: dto.type,
          weekStart,
        },
      },
    });
    if (existing) throw new ConflictException('Review already exists for this period');

    const review = await this.prisma.weeklyReview.create({
      data: {
        orgId,
        revieweeId,
        reviewerId,
        type: dto.type,
        weekStart,
        wins: dto.wins,
        challenges: dto.challenges,
        learning: dto.learning,
        feedback: dto.feedback,
        rating: dto.rating,
      },
      select: this.reviewSelect,
    });

    this.logger.log(`Review created: ${review.id} by ${userId}`);

    if (dto.type === ReviewType.manager) {
      const { type, title, body, entityType, entityId, actionUrl } = NotificationTemplates.reviewRequested(
        `${review.reviewer.firstName} ${review.reviewer.lastName}`,
        review.id,
      );
      await this.notifications.notify({
        userId: review.revieweeId,
        orgId,
        type,
        title,
        body,
        entityType,
        entityId,
        actionUrl,
      });
    }

    return review;
  }

  async update(id: string, userId: string, orgId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.weeklyReview.findFirst({ where: { id, orgId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.reviewerId !== userId) throw new ForbiddenException('Not your review');
    if (review.status === ReviewStatus.submitted)
      throw new ForbiddenException('Cannot edit a submitted review');

    return this.prisma.weeklyReview.update({
      where: { id },
      data: dto,
      select: this.reviewSelect,
    });
  }

  async submit(id: string, userId: string, orgId: string) {
    const review = await this.prisma.weeklyReview.findFirst({ where: { id, orgId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.reviewerId !== userId) throw new ForbiddenException('Not your review');
    if (review.status === ReviewStatus.submitted)
      throw new BadRequestException('Review already submitted');

    const updated = await this.prisma.weeklyReview.update({
      where: { id },
      data: { status: ReviewStatus.submitted, submittedAt: new Date() },
      select: this.reviewSelect,
    });

    if (updated.type === ReviewType.manager) {
      const { type, title, body, entityType, entityId, actionUrl } = NotificationTemplates.reviewCompleted(
        `${updated.reviewer.firstName} ${updated.reviewer.lastName}`,
        updated.id,
      );
      await this.notifications.notify({
        userId: updated.revieweeId,
        orgId,
        type,
        title,
        body,
        entityType,
        entityId,
        actionUrl,
      });
    }

    return updated;
  }

  async findMine(userId: string, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { revieweeId: userId, orgId };

    const [data, total] = await Promise.all([
      this.prisma.weeklyReview.findMany({
        where,
        select: this.reviewSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { weekStart: 'desc' },
      }),
      this.prisma.weeklyReview.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findGiven(userId: string, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { reviewerId: userId, orgId };

    const [data, total] = await Promise.all([
      this.prisma.weeklyReview.findMany({
        where,
        select: this.reviewSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { weekStart: 'desc' },
      }),
      this.prisma.weeklyReview.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, orgId: string, userId: string) {
    const review = await this.prisma.weeklyReview.findFirst({
      where: { id, orgId },
      select: this.reviewSelect,
    });
    if (!review) throw new NotFoundException('Review not found');

    // Only reviewer or reviewee can read
    if (review.reviewerId !== userId && review.revieweeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return review;
  }

  async findByUser(targetUserId: string, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { revieweeId: targetUserId, orgId };

    const [data, total] = await Promise.all([
      this.prisma.weeklyReview.findMany({
        where,
        select: this.reviewSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { weekStart: 'desc' },
      }),
      this.prisma.weeklyReview.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findPending(userId: string, orgId: string) {
    // Find all people this user manages, check if reviews are created this week
    const monday = this.getMondayOfWeek(new Date().toISOString());

    const reports = await this.prisma.user.findMany({
      where: { managerId: userId, orgId, isActive: true },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
    });

    const pendingReviews = [];

    for (const report of reports) {
      const existing = await this.prisma.weeklyReview.findUnique({
        where: {
          revieweeId_reviewerId_type_weekStart: {
            revieweeId: report.id,
            reviewerId: userId,
            type: ReviewType.manager,
            weekStart: monday,
          },
        },
      });

      if (!existing || existing.status === ReviewStatus.draft) {
        pendingReviews.push({
          reportee: report,
          review: existing,
          weekStart: monday,
        });
      }
    }

    return pendingReviews;
  }
}
