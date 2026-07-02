import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { GoalStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto, UpdateGoalProgressDto } from './dto/update-goal.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(private prisma: PrismaService) {}

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
    updatedAt: true,
    userId: true,
    orgId: true,
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

  async create(userId: string, orgId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        userId,
        orgId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      select: this.goalSelect,
    });

    this.logger.log(`Goal created: ${goal.id} for user ${userId}`);
    return goal;
  }

  async update(id: string, userId: string, orgId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== userId) throw new ForbiddenException('Not your goal');
    if (goal.status === GoalStatus.archived)
      throw new BadRequestException('Cannot update archived goals');

    return this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      },
      select: this.goalSelect,
    });
  }

  async updateProgress(
    id: string,
    userId: string,
    orgId: string,
    dto: UpdateGoalProgressDto,
  ) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== userId) throw new ForbiddenException('Not your goal');
    if (goal.status === GoalStatus.archived)
      throw new BadRequestException('Cannot update archived goals');

    const [updatedGoal] = await this.prisma.$transaction([
      this.prisma.goal.update({
        where: { id },
        data: { progress: dto.progress },
        select: this.goalSelect,
      }),
      this.prisma.goalHistory.create({
        data: { goalId: id, progress: dto.progress, note: dto.note },
      }),
    ]);

    this.logger.log(`Goal ${id} progress updated to ${dto.progress}%`);
    return updatedGoal;
  }

  async complete(id: string, userId: string, orgId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== userId) throw new ForbiddenException('Not your goal');
    if (goal.status === GoalStatus.archived)
      throw new BadRequestException('Cannot complete an archived goal');
    if (goal.status === GoalStatus.completed)
      throw new BadRequestException('Goal already completed');

    const now = new Date();
    const [updatedGoal] = await this.prisma.$transaction([
      this.prisma.goal.update({
        where: { id },
        data: { status: GoalStatus.completed, progress: 100, completedAt: now },
        select: this.goalSelect,
      }),
      this.prisma.goalHistory.create({
        data: { goalId: id, progress: 100, note: 'Goal completed' },
      }),
    ]);

    return updatedGoal;
  }

  async archive(id: string, userId: string, orgId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== userId) throw new ForbiddenException('Not your goal');
    if (goal.status === GoalStatus.archived)
      throw new BadRequestException('Goal already archived');

    return this.prisma.goal.update({
      where: { id },
      data: { status: GoalStatus.archived, archivedAt: new Date() },
      select: this.goalSelect,
    });
  }

  async findMine(
    userId: string,
    orgId: string,
    pagination: PaginationDto,
    status?: GoalStatus,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      userId,
      orgId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        select: this.goalSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goal.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findAll(
    orgId: string,
    pagination: PaginationDto,
    userId?: string,
    status?: GoalStatus,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      orgId,
      ...(userId && { userId }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        select: this.goalSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goal.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, orgId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, orgId },
      select: {
        ...this.goalSelect,
        history: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }
}
