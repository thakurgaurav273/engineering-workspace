import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { GoalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtPayload } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto, UpdateGoalProgressDto } from './dto/update-goal.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private readonly goalSelect = {
    id: true,
    title: true,
    description: true,
    progress: true,
    status: true,
    visibility: true,
    dueDate: true,
    completedAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    userId: true,
    orgId: true,
    assignedById: true,
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
    assignedBy: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
  };

  private isAdmin(caller: JwtPayload): boolean {
    return caller.role === 'OWNER' || caller.role === 'ADMIN';
  }

  /** User ids of the caller's direct reports in this org (for manager visibility of personal goals). */
  private async getReportUserIds(managerUserId: string, orgId: string): Promise<string[]> {
    const managerMembership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: managerUserId, orgId } },
    });
    if (!managerMembership) return [];
    const reports = await this.prisma.membership.findMany({
      where: { managerId: managerMembership.id },
      select: { userId: true },
    });
    return reports.map((r) => r.userId);
  }

  /**
   * The set of goals a caller may see: their own, any `team` goal, and (for managers)
   * their reports' goals. Admins see everything (returns an empty filter). Applied as an
   * extra AND condition on top of the org/status/userId filters.
   */
  private async visibilityFilter(caller: JwtPayload): Promise<Prisma.GoalWhereInput> {
    if (this.isAdmin(caller)) return {};
    const reportIds = await this.getReportUserIds(caller.sub, caller.orgId);
    return {
      OR: [
        { userId: caller.sub },
        { visibility: 'team' },
        ...(reportIds.length ? [{ userId: { in: reportIds } }] : []),
      ],
    };
  }

  async create(caller: JwtPayload, dto: CreateGoalDto) {
    const targetUserId = dto.userId ?? caller.sub;
    const isAssigningToOther = targetUserId !== caller.sub;

    if (isAssigningToOther && !this.isAdmin(caller)) {
      throw new ForbiddenException('Only admins can assign goals to other people');
    }
    if (isAssigningToOther) {
      const target = await this.prisma.membership.findFirst({
        where: { userId: targetUserId, orgId: caller.orgId, status: 'ACTIVE' },
      });
      if (!target) throw new NotFoundException('Assignee is not an active member of this org');
    }

    const goal = await this.prisma.goal.create({
      data: {
        userId: targetUserId,
        orgId: caller.orgId,
        assignedById: isAssigningToOther ? caller.sub : null,
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility ?? undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      select: this.goalSelect,
    });

    this.logger.log(`Goal created: ${goal.id} for user ${targetUserId}`);

    if (isAssigningToOther) {
      const assigner = await this.prisma.user.findUnique({
        where: { id: caller.sub },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      if (assigner) {
        const payload = NotificationTemplates.goalAssigned(
          `${assigner.firstName} ${assigner.lastName}`,
          goal.id,
          goal.title,
          assigner.avatarUrl,
        );
        await this.notifications.notify({ userId: targetUserId, orgId: caller.orgId, ...payload });
      }
    }

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
        ...(dto.visibility && { visibility: dto.visibility }),
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

  // The owner can archive their own goal; an admin can archive anyone's (but cannot edit,
  // update progress, or complete someone else's goal - those stay owner-only).
  async archive(id: string, caller: JwtPayload) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId: caller.orgId } });
    if (!goal) throw new NotFoundException('Goal not found');

    const isOwner = goal.userId === caller.sub;
    if (!isOwner && !this.isAdmin(caller)) {
      throw new ForbiddenException('Only the goal owner or an admin can archive this goal');
    }
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
    caller: JwtPayload,
    pagination: PaginationDto,
    userId?: string,
    status?: GoalStatus,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const where: Prisma.GoalWhereInput = {
      orgId: caller.orgId,
      ...(userId && { userId }),
      ...(status && { status }),
      AND: [await this.visibilityFilter(caller)],
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

  async findOne(id: string, caller: JwtPayload) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, orgId: caller.orgId },
      select: {
        ...this.goalSelect,
        history: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const isOwner = goal.userId === caller.sub;
    const isTeam = goal.visibility === 'team';
    if (!isOwner && !isTeam && !this.isAdmin(caller)) {
      const reportIds = await this.getReportUserIds(caller.sub, caller.orgId);
      if (!reportIds.includes(goal.userId)) {
        throw new NotFoundException('Goal not found');
      }
    }

    return goal;
  }
}
