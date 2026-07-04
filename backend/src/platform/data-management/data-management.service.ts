import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/dto/pagination.dto';
import { AdminListQueryDto } from './dto/admin-list-query.dto';

// Notification.entityType values written by NotificationTemplates / callers — see
// backend/src/platform/notifications/notification-templates.ts. Kept in sync here so
// deleting an entity also removes any notification that references it, preventing orphans.
const ENTITY_TYPE = {
  checkIn: 'checkin',
  recognition: 'recognition',
  review: 'review',
  goal: 'goal',
} as const;

const userSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
};

@Injectable()
export class DataManagementService {
  constructor(private prisma: PrismaService) {}

  private readonly checkInSelect = {
    id: true,
    status: true,
    summary: true,
    blockers: true,
    date: true,
    createdAt: true,
    updatedAt: true,
    user: { select: userSummarySelect },
  };

  private readonly recognitionSelect = {
    id: true,
    title: true,
    note: true,
    createdAt: true,
    author: { select: userSummarySelect },
    recipient: { select: userSummarySelect },
  };

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
    reviewee: { select: userSummarySelect },
    reviewer: { select: userSummarySelect },
  };

  private readonly goalSelect = {
    id: true,
    title: true,
    description: true,
    progress: true,
    status: true,
    dueDate: true,
    completedAt: true,
    archivedAt: true,
    createdAt: true,
    user: { select: userSummarySelect },
  };

  private readonly notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    entityType: true,
    entityId: true,
    isRead: true,
    createdAt: true,
    user: { select: userSummarySelect },
  };

  private dateRangeFilter(from?: string, to?: string) {
    if (!from && !to) return {};
    return {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    };
  }

  // ---------------------------------------------------------------------------
  // Check-ins
  // ---------------------------------------------------------------------------

  async listCheckIns(orgId: string, query: AdminListQueryDto) {
    const { page = 1, limit = 20, search, userId, from, to } = query;
    const where = {
      orgId,
      ...(userId && { userId }),
      ...(search && {
        OR: [
          { summary: { contains: search, mode: 'insensitive' as const } },
          { blockers: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(from || to ? { date: this.dateRangeFilter(from, to) } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        select: this.checkInSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async deleteCheckIn(orgId: string, id: string) {
    const checkIn = await this.prisma.checkIn.findFirst({ where: { id, orgId } });
    if (!checkIn) throw new NotFoundException('Check-in not found');

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.checkIn, entityId: id },
      }),
      this.prisma.checkIn.delete({ where: { id } }),
    ]);

    return { message: 'Check-in deleted' };
  }

  async bulkDeleteCheckIns(orgId: string, ids: string[]) {
    const [, result] = await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.checkIn, entityId: { in: ids } },
      }),
      this.prisma.checkIn.deleteMany({ where: { orgId, id: { in: ids } } }),
    ]);

    return { message: `${result.count} check-in(s) deleted`, count: result.count };
  }

  // ---------------------------------------------------------------------------
  // Recognitions
  // ---------------------------------------------------------------------------

  async listRecognitions(orgId: string, query: AdminListQueryDto) {
    const { page = 1, limit = 20, search, userId, from, to } = query;
    const where = {
      orgId,
      AND: [
        ...(userId ? [{ OR: [{ authorId: userId }, { recipientId: userId }] }] : []),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  { note: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
      ...(from || to ? { createdAt: this.dateRangeFilter(from, to) } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.recognition.findMany({
        where,
        select: this.recognitionSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.recognition.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async deleteRecognition(orgId: string, id: string) {
    const recognition = await this.prisma.recognition.findFirst({ where: { id, orgId } });
    if (!recognition) throw new NotFoundException('Recognition not found');

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.recognition, entityId: id },
      }),
      this.prisma.recognition.delete({ where: { id } }),
    ]);

    return { message: 'Recognition deleted' };
  }

  async bulkDeleteRecognitions(orgId: string, ids: string[]) {
    const [, result] = await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.recognition, entityId: { in: ids } },
      }),
      this.prisma.recognition.deleteMany({ where: { orgId, id: { in: ids } } }),
    ]);

    return { message: `${result.count} recognition(s) deleted`, count: result.count };
  }

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------

  async listReviews(orgId: string, query: AdminListQueryDto) {
    const { page = 1, limit = 20, search, userId, from, to } = query;
    const where = {
      orgId,
      AND: [
        ...(userId ? [{ OR: [{ revieweeId: userId }, { reviewerId: userId }] }] : []),
        ...(search
          ? [
              {
                OR: [
                  { wins: { contains: search, mode: 'insensitive' as const } },
                  { challenges: { contains: search, mode: 'insensitive' as const } },
                  { learning: { contains: search, mode: 'insensitive' as const } },
                  { feedback: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
      ...(from || to ? { weekStart: this.dateRangeFilter(from, to) } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.weeklyReview.findMany({
        where,
        select: this.reviewSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { weekStart: 'desc' as const },
      }),
      this.prisma.weeklyReview.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async deleteReview(orgId: string, id: string) {
    const review = await this.prisma.weeklyReview.findFirst({ where: { id, orgId } });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.review, entityId: id },
      }),
      this.prisma.weeklyReview.delete({ where: { id } }),
    ]);

    return { message: 'Review deleted' };
  }

  async bulkDeleteReviews(orgId: string, ids: string[]) {
    const [, result] = await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.review, entityId: { in: ids } },
      }),
      this.prisma.weeklyReview.deleteMany({ where: { orgId, id: { in: ids } } }),
    ]);

    return { message: `${result.count} review(s) deleted`, count: result.count };
  }

  // ---------------------------------------------------------------------------
  // Goals (GoalHistory cascades automatically via the schema's onDelete: Cascade)
  // ---------------------------------------------------------------------------

  async listGoals(orgId: string, query: AdminListQueryDto) {
    const { page = 1, limit = 20, search, userId, from, to } = query;
    const where = {
      orgId,
      ...(userId && { userId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(from || to ? { createdAt: this.dateRangeFilter(from, to) } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        select: this.goalSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.goal.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async deleteGoal(orgId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId } });
    if (!goal) throw new NotFoundException('Goal not found');

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.goal, entityId: id },
      }),
      this.prisma.goal.delete({ where: { id } }),
    ]);

    return { message: 'Goal deleted' };
  }

  async bulkDeleteGoals(orgId: string, ids: string[]) {
    const [, result] = await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { orgId, entityType: ENTITY_TYPE.goal, entityId: { in: ids } },
      }),
      this.prisma.goal.deleteMany({ where: { orgId, id: { in: ids } } }),
    ]);

    return { message: `${result.count} goal(s) deleted`, count: result.count };
  }

  // ---------------------------------------------------------------------------
  // Notifications (leaf entity — nothing else references them, no cascade needed)
  // ---------------------------------------------------------------------------

  async listNotifications(orgId: string, query: AdminListQueryDto) {
    const { page = 1, limit = 20, search, userId, from, to } = query;
    const where = {
      orgId,
      ...(userId && { userId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { body: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(from || to ? { createdAt: this.dateRangeFilter(from, to) } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: this.notificationSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async deleteNotification(orgId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, orgId } });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }

  async bulkDeleteNotifications(orgId: string, ids: string[]) {
    const result = await this.prisma.notification.deleteMany({ where: { orgId, id: { in: ids } } });
    return { message: `${result.count} notification(s) deleted`, count: result.count };
  }
}
