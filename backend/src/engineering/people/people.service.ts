import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

export interface TimelineItem {
  type: 'check-in' | 'goal' | 'review' | 'recognition';
  date: Date;
  data: Record<string, unknown>;
}

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(private prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    orgId: true,
    managerId: true,
    jobTitle: true,
    department: true,
    role: true,
    isActive: true,
    createdAt: true,
    manager: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
    },
    reports: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
      where: { isActive: true },
    },
  };

  async findAll(
    orgId: string,
    pagination: PaginationDto,
    search?: string,
    department?: string,
    isActive?: boolean,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      ...(isActive !== undefined && { isActive }),
      ...(department && { department }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { jobTitle: { contains: search, mode: 'insensitive' as const } },
          { department: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.userSelect,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, orgId: string) {
    const person = await this.prisma.user.findFirst({
      where: { id, orgId },
      select: { ...this.userSelect, preference: true },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
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

    const [checkIns, goals, reviews, recognitions] = await Promise.all([
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
    ]);

    const timeline: TimelineItem[] = [
      ...checkIns.map((c) => ({ type: 'check-in' as const, date: c.createdAt, data: c as unknown as Record<string, unknown> })),
      ...goals.map((g) => ({ type: 'goal' as const, date: g.updatedAt, data: g as unknown as Record<string, unknown> })),
      ...reviews.map((r) => ({ type: 'review' as const, date: r.submittedAt ?? r.createdAt, data: r as unknown as Record<string, unknown> })),
      ...recognitions.map((r) => ({ type: 'recognition' as const, date: r.createdAt, data: r as unknown as Record<string, unknown> })),
    ];

    // Sort chronologically descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline;
  }
}
