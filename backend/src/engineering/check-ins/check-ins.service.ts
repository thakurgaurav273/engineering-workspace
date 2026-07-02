import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { UpdateCheckInDto } from './dto/update-check-in.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class CheckInsService {
  private readonly logger = new Logger(CheckInsService.name);

  constructor(private prisma: PrismaService) {}

  private get today() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private isSameDay(date: Date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() === this.today.getTime();
  }

  private readonly checkInSelect = {
    id: true,
    status: true,
    summary: true,
    blockers: true,
    date: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        jobTitle: true,
        department: true,
      },
    },
  };

  async create(userId: string, orgId: string, dto: CreateCheckInDto) {
    const existing = await this.prisma.checkIn.findUnique({
      where: { userId_date: { userId, date: this.today } },
    });
    if (existing) throw new ConflictException('You have already checked in today');

    const checkIn = await this.prisma.checkIn.create({
      data: { userId, orgId, ...dto, date: this.today },
      select: this.checkInSelect,
    });

    this.logger.log(`Check-in created for user ${userId}`);
    return checkIn;
  }

  async update(id: string, userId: string, orgId: string, dto: UpdateCheckInDto) {
    const checkIn = await this.prisma.checkIn.findFirst({ where: { id, orgId } });
    if (!checkIn) throw new NotFoundException('Check-in not found');
    if (checkIn.userId !== userId) throw new ForbiddenException('Not your check-in');
    if (!this.isSameDay(checkIn.date))
      throw new ForbiddenException("Can only edit today's check-in");

    return this.prisma.checkIn.update({
      where: { id },
      data: dto,
      select: this.checkInSelect,
    });
  }

  async remove(id: string, userId: string, orgId: string) {
    const checkIn = await this.prisma.checkIn.findFirst({ where: { id, orgId } });
    if (!checkIn) throw new NotFoundException('Check-in not found');
    if (checkIn.userId !== userId) throw new ForbiddenException('Not your check-in');
    if (!this.isSameDay(checkIn.date))
      throw new ForbiddenException("Can only delete today's check-in");

    await this.prisma.checkIn.delete({ where: { id } });
    return { message: 'Check-in deleted' };
  }

  async findMine(
    userId: string,
    orgId: string,
    pagination: PaginationDto,
    from?: string,
    to?: string,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      userId,
      orgId,
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        select: this.checkInSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findAll(
    orgId: string,
    pagination: PaginationDto,
    userId?: string,
    from?: string,
    to?: string,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      orgId,
      ...(userId && { userId }),
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        select: this.checkInSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findToday(orgId: string) {
    return this.prisma.checkIn.findMany({
      where: { orgId, date: this.today },
      select: this.checkInSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(orgId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setUTCHours(0, 0, 0, 0);

    const [totalUsers, weekCheckIns] = await Promise.all([
      this.prisma.user.count({ where: { orgId, isActive: true } }),
      this.prisma.checkIn.groupBy({
        by: ['date'],
        where: { orgId, date: { gte: weekAgo } },
        _count: true,
        orderBy: { date: 'asc' },
      }),
    ]);

    const totalCheckIns = weekCheckIns.reduce((s, d) => s + d._count, 0);
    const checkInRate =
      totalUsers > 0 ? Math.round((totalCheckIns / (totalUsers * 7)) * 100) : 0;

    return {
      totalUsers,
      checkInRate,
      weeklyTrends: weekCheckIns.map((d) => ({ date: d.date, count: d._count })),
    };
  }
}
