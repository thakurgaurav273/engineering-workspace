import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { JwtPayload } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';
import { LinearSyncService } from '@/platform/integrations/linear/linear-sync.service';
import { LinearIntegrationService } from '@/platform/integrations/linear/linear-integration.service';
import { ListIssuesDto } from './dto/list-issues.dto';
import { CreateTaskUpdateDto } from './dto/create-task-update.dto';
import { UpdateTaskUpdateDto } from './dto/update-task-update.dto';

@Injectable()
export class TaskUpdatesService {
  private readonly logger = new Logger(TaskUpdatesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private linearSync: LinearSyncService,
    private linearIntegration: LinearIntegrationService,
  ) {}

  private readonly issueListSelect = {
    id: true,
    identifier: true,
    title: true,
    url: true,
    stateName: true,
    stateType: true,
    priority: true,
    estimate: true,
    dueDate: true,
    assigneeId: true,
    syncedAt: true,
    assignee: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, managerId: true },
    },
    updates: {
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      select: { id: true, body: true, status: true, progress: true, createdAt: true },
    },
  };

  private readonly updateSelect = {
    id: true,
    body: true,
    progress: true,
    status: true,
    timeSpentMinutes: true,
    isEdited: true,
    editedAt: true,
    createdAt: true,
    updatedAt: true,
    author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    issue: { select: { id: true, identifier: true, title: true, url: true } },
    attachments: true,
  };

  // Self can always see their own; a direct manager or org admin/owner can see anyone's -
  // matches the hierarchy already used by UsersService/ReviewsService, but keyed off
  // User.managerId rather than the OWNER/ADMIN role hierarchy.
  private assertCanView(caller: JwtPayload, targetUserId: string, targetManagerId: string | null) {
    if (caller.sub === targetUserId) return;
    if (caller.role === 'OWNER' || caller.role === 'ADMIN') return;
    if (targetManagerId && targetManagerId === caller.sub) return;
    throw new ForbiddenException("You do not have access to this person's activity");
  }

  async listMyIssues(caller: JwtPayload, query: ListIssuesDto) {
    const { page = 1, limit = 20, state, search, userIds } = query;
    const isAdmin = caller.role === 'OWNER' || caller.role === 'ADMIN';
    const requestedIds = isAdmin && userIds
      ? userIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    const where = {
      orgId: caller.orgId,
      assigneeId: requestedIds.length ? { in: requestedIds } : caller.sub,
      archivedAt: null,
      ...(state && { stateType: state }),
      ...(search && {
        OR: [
          { identifier: { contains: search, mode: 'insensitive' as const } },
          { title: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.linearIssue.findMany({
        where,
        select: this.issueListSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { syncedAt: 'desc' },
      }),
      this.prisma.linearIssue.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getIssueDetail(issueId: string, orgId: string, caller: JwtPayload, pagination: PaginationDto) {
    const issue = await this.prisma.linearIssue.findFirst({
      where: { id: issueId, orgId },
      select: this.issueListSelect,
    });
    if (!issue) throw new NotFoundException('Issue not found');

    this.assertCanView(caller, issue.assigneeId ?? '', issue.assignee?.managerId ?? null);

    const { page = 1, limit = 20 } = pagination;
    const where = { issueId, orgId, isDeleted: false };
    const [updates, total] = await Promise.all([
      this.prisma.taskUpdate.findMany({
        where,
        select: this.updateSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.taskUpdate.count({ where }),
    ]);

    return {
      issue,
      updates,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async postUpdate(issueId: string, orgId: string, userId: string, dto: CreateTaskUpdateDto) {
    const issue = await this.prisma.linearIssue.findFirst({
      where: { id: issueId, orgId },
      select: { id: true, identifier: true, assigneeId: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    if (issue.assigneeId !== userId) {
      throw new ForbiddenException('Only the assigned engineer can post an update on this issue');
    }

    const update = await this.prisma.taskUpdate.create({
      data: { orgId, issueId, authorId: userId, ...dto },
      select: this.updateSelect,
    });

    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, avatarUrl: true, managerId: true },
    });
    if (author?.managerId) {
      const payload = NotificationTemplates.taskUpdatePosted(
        `${author.firstName} ${author.lastName}`,
        issue.identifier,
        issue.id,
        update.id,
        author.avatarUrl,
      );
      await this.notifications.notify({ userId: author.managerId, orgId, ...payload });
    }

    return update;
  }

  async editUpdate(id: string, orgId: string, userId: string, dto: UpdateTaskUpdateDto) {
    const existing = await this.prisma.taskUpdate.findFirst({ where: { id, orgId, isDeleted: false } });
    if (!existing) throw new NotFoundException('Task update not found');
    if (existing.authorId !== userId) throw new ForbiddenException('Not your update');

    return this.prisma.taskUpdate.update({
      where: { id },
      data: { ...dto, isEdited: true, editedAt: new Date() },
      select: this.updateSelect,
    });
  }

  async deleteUpdate(id: string, orgId: string, caller: JwtPayload) {
    const existing = await this.prisma.taskUpdate.findFirst({
      where: { id, orgId, isDeleted: false },
      select: { id: true, authorId: true, author: { select: { managerId: true } } },
    });
    if (!existing) throw new NotFoundException('Task update not found');

    const isAuthor = existing.authorId === caller.sub;
    const isManager = existing.author.managerId === caller.sub;
    const isAdmin = caller.role === 'OWNER' || caller.role === 'ADMIN';
    if (!isAuthor && !isManager && !isAdmin) {
      throw new ForbiddenException('You cannot delete this update');
    }

    await this.prisma.taskUpdate.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return { message: 'Task update deleted' };
  }

  async findMine(userId: string, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { orgId, authorId: userId, isDeleted: false };

    const [data, total] = await Promise.all([
      this.prisma.taskUpdate.findMany({
        where,
        select: this.updateSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.taskUpdate.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getUserActivity(targetUserId: string, orgId: string, caller: JwtPayload, pagination: PaginationDto) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, orgId },
      select: { id: true, managerId: true },
    });
    if (!target) throw new NotFoundException('User not found');

    this.assertCanView(caller, target.id, target.managerId);

    const { page = 1, limit = 20 } = pagination;
    const updatesWhere = { orgId, authorId: targetUserId, isDeleted: false };

    const [issues, updates, updatesTotal] = await Promise.all([
      this.prisma.linearIssue.findMany({
        where: { orgId, assigneeId: targetUserId, archivedAt: null },
        select: this.issueListSelect,
        orderBy: { syncedAt: 'desc' },
      }),
      this.prisma.taskUpdate.findMany({
        where: updatesWhere,
        select: this.updateSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.taskUpdate.count({ where: updatesWhere }),
    ]);

    return {
      issues,
      updates,
      meta: { page, limit, total: updatesTotal, totalPages: Math.ceil(updatesTotal / limit) },
    };
  }

  async getTeamFeed(caller: JwtPayload, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where: { orgId: string; isDeleted: boolean; authorId?: { in: string[] } } = {
      orgId,
      isDeleted: false,
    };

    if (caller.role !== 'OWNER' && caller.role !== 'ADMIN') {
      const reports = await this.prisma.user.findMany({
        where: { managerId: caller.sub, orgId },
        select: { id: true },
      });
      if (!reports.length) return paginate([], 0, page, limit);
      where.authorId = { in: reports.map((r) => r.id) };
    }

    const [data, total] = await Promise.all([
      this.prisma.taskUpdate.findMany({
        where,
        select: this.updateSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.taskUpdate.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async triggerSync(orgId: string) {
    return this.linearSync.syncAssignedIssues(orgId);
  }

  async getSyncStatus(orgId: string) {
    const [linearStatus, aggregate] = await Promise.all([
      this.linearIntegration.getStatus(orgId),
      this.prisma.linearIssue.aggregate({
        where: { orgId, archivedAt: null },
        _max: { syncedAt: true },
        _count: true,
      }),
    ]);

    return {
      linearConnected: linearStatus.connected,
      workspaceName: linearStatus.workspaceName,
      lastSyncedAt: aggregate._max.syncedAt,
      issueCount: aggregate._count,
    };
  }
}
