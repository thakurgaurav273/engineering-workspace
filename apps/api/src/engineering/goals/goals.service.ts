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
import { GoalProgressService, GoalWork } from './goal-progress.service';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private goalProgress: GoalProgressService,
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
    // The work the goal is delivered through (see GoalProgressService).
    projects: {
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' as const },
    },
    issues: {
      select: {
        id: true,
        number: true,
        title: true,
        team: { select: { key: true } },
        state: { select: { name: true, color: true, category: true } },
      },
    },
  };

  /**
   * Shapes goals for the client: linked issues get their identifier (ENG-12), and each goal
   * carries `work` - how far its linked work has got - or null when progress is manual.
   */
  private async present<
    G extends {
      id: string;
      projects: { id: string }[];
      issues: { id: string; number: number; title: string; team: { key: string }; state: unknown }[];
    },
  >(goals: G[]): Promise<(Omit<G, 'issues'> & { issues: unknown[]; work: GoalWork | null })[]> {
    const work = await this.goalProgress.workFor(goals);
    return goals.map((goal) => ({
      ...goal,
      issues: goal.issues.map(({ number, team, ...issue }) => ({
        ...issue,
        identifier: `${team.key}-${number}`,
      })),
      work: work.get(goal.id) ?? null,
    }));
  }

  private async presentOne<G extends Parameters<GoalsService['present']>[0][number]>(goal: G) {
    return (await this.present([goal]))[0];
  }

  /** Owner, the person who assigned it, or an org admin may change a goal. */
  private canManage(goal: { userId: string; assignedById: string | null }, caller: JwtPayload): boolean {
    return goal.userId === caller.sub || goal.assignedById === caller.sub || this.isAdmin(caller);
  }

  /** Linked work must be this org's (and not deleted issues). */
  private async assertLinkable(orgId: string, projectIds?: string[], issueIds?: string[]) {
    if (projectIds?.length) {
      const found = await this.prisma.project.count({ where: { id: { in: projectIds }, orgId } });
      if (found !== new Set(projectIds).size) {
        throw new BadRequestException("Some of the linked projects don't exist in this organization");
      }
    }
    if (issueIds?.length) {
      const found = await this.prisma.issue.count({
        where: { id: { in: issueIds }, orgId, deletedAt: null },
      });
      if (found !== new Set(issueIds).size) {
        throw new BadRequestException("Some of the linked issues don't exist in this organization");
      }
    }
  }

  private isLinked(goal: { projects: unknown[]; issues: unknown[] }): boolean {
    return goal.projects.length > 0 || goal.issues.length > 0;
  }

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
    await this.assertLinkable(caller.orgId, dto.projectIds, dto.issueIds);

    const goal = await this.prisma.goal.create({
      data: {
        userId: targetUserId,
        orgId: caller.orgId,
        assignedById: isAssigningToOther ? caller.sub : null,
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility ?? undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ...(dto.projectIds?.length && { projects: { connect: dto.projectIds.map((id) => ({ id })) } }),
        ...(dto.issueIds?.length && { issues: { connect: dto.issueIds.map((id) => ({ id })) } }),
      },
      select: { id: true },
    });
    // A goal created with linked work starts measured by it.
    await this.goalProgress.syncGoals([goal.id]);
    const created = await this.prisma.goal.findUniqueOrThrow({
      where: { id: goal.id },
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
          created.title,
          assigner.avatarUrl,
        );
        await this.notifications.notify({ userId: targetUserId, orgId: caller.orgId, ...payload });
      }
    }

    return this.presentOne(created);
  }

  async update(id: string, caller: JwtPayload, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId: caller.orgId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (!this.canManage(goal, caller)) {
      throw new ForbiddenException('Only the goal owner, whoever assigned it, or an admin can edit it');
    }
    if (goal.status === GoalStatus.archived)
      throw new BadRequestException('Cannot update archived goals');
    await this.assertLinkable(caller.orgId, dto.projectIds, dto.issueIds);

    await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.visibility && { visibility: dto.visibility }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        // Links are replaced as a whole. Unlinking everything returns the goal to manual progress
        // (it keeps its last value).
        ...(dto.projectIds !== undefined && { projects: { set: dto.projectIds.map((pid) => ({ id: pid })) } }),
        ...(dto.issueIds !== undefined && { issues: { set: dto.issueIds.map((iid) => ({ id: iid })) } }),
      },
    });
    if (dto.projectIds !== undefined || dto.issueIds !== undefined) {
      await this.goalProgress.syncGoals([id]);
    }
    return this.presentOne(
      await this.prisma.goal.findUniqueOrThrow({ where: { id }, select: this.goalSelect }),
    );
  }

  /** Manual progress and completion are for goals without linked work. */
  private async loadManual(id: string, caller: JwtPayload) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, orgId: caller.orgId },
      include: { projects: { select: { id: true } }, issues: { select: { id: true } } },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    if (!this.canManage(goal, caller)) {
      throw new ForbiddenException('Only the goal owner, whoever assigned it, or an admin can change it');
    }
    if (this.isLinked(goal)) {
      throw new BadRequestException(
        "This goal follows its linked work - its progress and completion update as those issues move",
      );
    }
    return goal;
  }

  async updateProgress(id: string, caller: JwtPayload, dto: UpdateGoalProgressDto) {
    const goal = await this.loadManual(id, caller);
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
    return this.presentOne(updatedGoal);
  }

  async complete(id: string, caller: JwtPayload) {
    const goal = await this.loadManual(id, caller);
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

    return this.presentOne(updatedGoal);
  }

  /** Brings a completed (manual) goal back to active; linked goals reopen with their work. */
  async reopen(id: string, caller: JwtPayload) {
    const goal = await this.loadManual(id, caller);
    if (goal.status !== GoalStatus.completed) {
      throw new BadRequestException('Only a completed goal can be reopened');
    }
    const [updatedGoal] = await this.prisma.$transaction([
      this.prisma.goal.update({
        where: { id },
        data: { status: GoalStatus.active, completedAt: null },
        select: this.goalSelect,
      }),
      this.prisma.goalHistory.create({
        data: { goalId: id, progress: goal.progress, note: 'Goal reopened' },
      }),
    ]);
    return this.presentOne(updatedGoal);
  }

  // The owner, whoever assigned the goal, or an admin can archive it.
  async archive(id: string, caller: JwtPayload) {
    const goal = await this.prisma.goal.findFirst({ where: { id, orgId: caller.orgId } });
    if (!goal) throw new NotFoundException('Goal not found');

    if (!this.canManage(goal, caller)) {
      throw new ForbiddenException('Only the goal owner, whoever assigned it, or an admin can archive it');
    }
    if (goal.status === GoalStatus.archived)
      throw new BadRequestException('Goal already archived');

    return this.presentOne(
      await this.prisma.goal.update({
        where: { id },
        data: { status: GoalStatus.archived, archivedAt: new Date() },
        select: this.goalSelect,
      }),
    );
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

    return paginate(await this.present(data), total, page, limit);
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

    return paginate(await this.present(data), total, page, limit);
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

    return this.presentOne(goal);
  }
}
