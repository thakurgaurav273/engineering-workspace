import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

export interface TimelineItem {
  type: 'check-in' | 'goal' | 'review' | 'recognition' | 'task-update';
  date: Date;
  data: Record<string, unknown>;
}

const membershipViewInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
  manager: {
    select: { jobTitle: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  },
  reports: {
    where: { status: MembershipStatus.ACTIVE },
    select: { jobTitle: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  },
} satisfies Prisma.MembershipInclude;

type MembershipView = Prisma.MembershipGetPayload<{ include: typeof membershipViewInclude }>;

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(private prisma: PrismaService) {}

  private toPersonView(m: MembershipView) {
    return {
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      orgId: m.orgId,
      managerId: m.manager?.user.id ?? null,
      jobTitle: m.jobTitle,
      department: m.department,
      role: m.role,
      isActive: m.status === MembershipStatus.ACTIVE,
      createdAt: m.joinedAt ?? m.createdAt,
      manager: m.manager
        ? {
            id: m.manager.user.id,
            firstName: m.manager.user.firstName,
            lastName: m.manager.user.lastName,
            avatarUrl: m.manager.user.avatarUrl,
            jobTitle: m.manager.jobTitle,
          }
        : null,
      reports: m.reports.map((r) => ({
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        avatarUrl: r.user.avatarUrl,
        jobTitle: r.jobTitle,
      })),
    };
  }

  async findAll(
    orgId: string,
    pagination: PaginationDto,
    search?: string,
    department?: string,
    isActive?: boolean,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.MembershipWhereInput = {
      orgId,
      status: { not: MembershipStatus.LEFT },
      ...(isActive !== undefined && {
        status: isActive ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
      }),
      ...(department && { department }),
      ...(search && {
        OR: [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.membership.findMany({
        where,
        include: membershipViewInclude,
        skip,
        take: limit,
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
      this.prisma.membership.count({ where }),
    ]);

    return paginate(rows.map((m) => this.toPersonView(m)), total, page, limit);
  }

  async findOne(id: string, orgId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: id, orgId },
      include: { ...membershipViewInclude, user: { include: { preference: true } } },
    });
    if (!membership) throw new NotFoundException('Person not found');
    return { ...this.toPersonView(membership), preference: membership.user.preference };
  }

  async getCheckIns(id: string, orgId: string, pagination: PaginationDto) {
    await this.findOne(id, orgId);
    const { page = 1, limit = 20 } = pagination;

    const [data, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { userId: id, orgId },
        select: {
          id: true,
          status: true,
          summary: true,
          blockers: true,
          date: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.checkIn.count({ where: { userId: id, orgId } }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getGoals(id: string, orgId: string, pagination: PaginationDto) {
    await this.findOne(id, orgId);
    const { page = 1, limit = 20 } = pagination;

    const [data, total] = await Promise.all([
      this.prisma.goal.findMany({
        where: { userId: id, orgId },
        select: {
          id: true,
          title: true,
          description: true,
          progress: true,
          status: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goal.count({ where: { userId: id, orgId } }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getReviews(id: string, orgId: string, pagination: PaginationDto) {
    await this.findOne(id, orgId);
    const { page = 1, limit = 20 } = pagination;

    const where = { revieweeId: id, orgId };
    const [data, total] = await Promise.all([
      this.prisma.weeklyReview.findMany({
        where,
        select: {
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
          reviewer: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { weekStart: 'desc' },
      }),
      this.prisma.weeklyReview.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getRecognitions(id: string, orgId: string, pagination: PaginationDto) {
    await this.findOne(id, orgId);
    const { page = 1, limit = 20 } = pagination;

    const where = { recipientId: id, orgId };
    const [data, total] = await Promise.all([
      this.prisma.recognition.findMany({
        where,
        select: {
          id: true,
          title: true,
          note: true,
          createdAt: true,
          author: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recognition.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getTimeline(id: string, orgId: string) {
    await this.findOne(id, orgId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);

    const [checkIns, goals, reviews, recognitions, taskUpdates] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { userId: id, orgId, date: { gte: thirtyDaysAgo } },
        select: { id: true, status: true, summary: true, blockers: true, date: true, createdAt: true },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.goal.findMany({
        where: { userId: id, orgId, updatedAt: { gte: thirtyDaysAgo } },
        select: { id: true, title: true, status: true, progress: true, completedAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      this.prisma.weeklyReview.findMany({
        where: { revieweeId: id, orgId, weekStart: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          type: true,
          weekStart: true,
          status: true,
          rating: true,
          wins: true,
          submittedAt: true,
          createdAt: true,
          reviewer: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { weekStart: 'desc' },
        take: 20,
      }),
      this.prisma.recognition.findMany({
        where: { recipientId: id, orgId, createdAt: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          title: true,
          note: true,
          createdAt: true,
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.taskUpdate.findMany({
        where: { authorId: id, orgId, isDeleted: false, createdAt: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          body: true,
          status: true,
          progress: true,
          createdAt: true,
          issue: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const timeline: TimelineItem[] = [
      ...checkIns.map((c) => ({ type: 'check-in' as const, date: c.createdAt, data: c as unknown as Record<string, unknown> })),
      ...goals.map((g) => ({ type: 'goal' as const, date: g.updatedAt, data: g as unknown as Record<string, unknown> })),
      ...reviews.map((r) => ({ type: 'review' as const, date: r.submittedAt ?? r.createdAt, data: r as unknown as Record<string, unknown> })),
      ...recognitions.map((r) => ({ type: 'recognition' as const, date: r.createdAt, data: r as unknown as Record<string, unknown> })),
      ...taskUpdates.map((t) => ({ type: 'task-update' as const, date: t.createdAt, data: t as unknown as Record<string, unknown> })),
    ];

    // Sort chronologically descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline;
  }
}
