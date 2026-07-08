import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, TaskUpdateAttachmentKind } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { JwtPayload } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';
import { StorageService } from '@/platform/storage/storage.service';
import {
  ImageUploadUrlDto,
  COMMENT_IMAGE_MIME_EXT,
} from '@/platform/storage/dto/image-upload.dto';
import { extractMentionIds } from '@/common/mentions';
import { mapImageAttachments } from '@/common/attachments';
import { LinearSyncService } from '@/platform/integrations/linear/linear-sync.service';
import { LinearIntegrationService } from '@/platform/integrations/linear/linear-integration.service';
import { ListIssuesDto } from './dto/list-issues.dto';
import { CreateTaskUpdateDto } from './dto/create-task-update.dto';
import { UpdateTaskUpdateDto } from './dto/update-task-update.dto';

// Sentinels a caller can pass inside the comma-separated `userIds` query param -
// distinguished from real cuid membership IDs by the double-underscore wrapping, and
// mirrored exactly in src/routes/task-updates.index.tsx's ALL_SENTINEL/UNASSIGNED_SENTINEL.
const ALL_SENTINEL = '__all__';
const UNASSIGNED_SENTINEL = '__unassigned__';

@Injectable()
export class TaskUpdatesService {
  private readonly logger = new Logger(TaskUpdatesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private storage: StorageService,
    private linearSync: LinearSyncService,
    private linearIntegration: LinearIntegrationService,
  ) {}

  /** Presigned R2 PUT URL for a task-update image attachment (uploaded before the update is posted). */
  createAttachmentUploadUrl(orgId: string, dto: ImageUploadUrlDto) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File uploads are not available right now');
    }
    const ext = COMMENT_IMAGE_MIME_EXT[dto.contentType];
    if (!ext) throw new BadRequestException('Unsupported image type');
    const key = this.storage.buildKey(`task-updates/${orgId}`, ext);
    return this.storage.presignUpload({ key, contentType: dto.contentType, contentLength: dto.size });
  }

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
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
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
  // the org-scoped Membership hierarchy rather than the OWNER/ADMIN role hierarchy.
  private assertCanView(caller: JwtPayload, targetUserId: string, targetManagerId: string | null) {
    if (caller.sub === targetUserId) return;
    if (caller.role === 'OWNER' || caller.role === 'ADMIN') return;
    if (targetManagerId && targetManagerId === caller.sub) return;
    throw new ForbiddenException("You do not have access to this person's activity");
  }

  private async getManagerUserId(userId: string, orgId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { manager: { select: { userId: true } } },
    });
    return membership?.manager?.userId ?? null;
  }

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

  async listMyIssues(caller: JwtPayload, query: ListIssuesDto) {
    const { page = 1, limit = 20, state, search, userIds } = query;
    const isAdmin = caller.role === 'OWNER' || caller.role === 'ADMIN';

    const conditions: Prisma.LinearIssueWhereInput[] = [
      { orgId: caller.orgId },
      { archivedAt: null },
    ];

    if (isAdmin && userIds === ALL_SENTINEL) {
      // No assignee restriction at all - this is the only way to reach issues whose
      // Linear assignee never matched a Membership email (assigneeId stays null on
      // sync but the row is still counted in getSyncStatus's issueCount), since they
      // can't be named by ID and would otherwise be permanently unreachable.
    } else if (isAdmin && userIds) {
      const rawIds = userIds.split(',').map((id) => id.trim()).filter(Boolean);
      const includeUnassigned = rawIds.includes(UNASSIGNED_SENTINEL);
      const realIds = rawIds.filter((id) => id !== UNASSIGNED_SENTINEL && id !== ALL_SENTINEL);

      const assigneeOr: Prisma.LinearIssueWhereInput[] = [];
      if (realIds.length) assigneeOr.push({ assigneeId: { in: realIds } });
      if (includeUnassigned) assigneeOr.push({ assigneeId: null });

      conditions.push(assigneeOr.length ? { OR: assigneeOr } : { assigneeId: caller.sub });
    } else {
      conditions.push({ assigneeId: caller.sub });
    }

    if (state) conditions.push({ stateType: state });
    if (search) {
      conditions.push({
        OR: [
          { identifier: { contains: search, mode: 'insensitive' as const } },
          { title: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }

    const where: Prisma.LinearIssueWhereInput = { AND: conditions };

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

    const assigneeManagerId = issue.assigneeId
      ? await this.getManagerUserId(issue.assigneeId, orgId)
      : null;
    this.assertCanView(caller, issue.assigneeId ?? '', assigneeManagerId);

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

    const { mentionedUserIds: _ignored, attachments, ...fields } = dto;
    const attachmentRows = mapImageAttachments(attachments, this.storage);

    const update = await this.prisma.taskUpdate.create({
      data: {
        orgId,
        issueId,
        authorId: userId,
        ...fields,
        ...(attachmentRows.length && { attachments: { create: attachmentRows } }),
      },
      select: this.updateSelect,
    });

    const authorMembership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        manager: { select: { userId: true } },
      },
    });

    const authorName = authorMembership
      ? `${authorMembership.user.firstName} ${authorMembership.user.lastName}`
      : 'Someone';
    const authorAvatar = authorMembership?.user.avatarUrl ?? null;

    if (authorMembership?.manager) {
      const payload = NotificationTemplates.taskUpdatePosted(
        authorName,
        issue.identifier,
        issue.id,
        update.id,
        authorAvatar,
      );
      await this.notifications.notify({ userId: authorMembership.manager.userId, orgId, ...payload });
    }

    // Notify anyone @mentioned in the body — excluding the manager already notified above.
    await this.notifications.notifyMentions({
      mentionedUserIds: extractMentionIds(update.body),
      orgId,
      authorId: userId,
      excludeUserIds: authorMembership?.manager ? [authorMembership.manager.userId] : [],
      payload: NotificationTemplates.mentioned(
        authorName,
        {
          surface: 'task-update',
          entityId: issue.id,
          label: issue.identifier,
          actionUrl: `/task-updates/${issue.id}`,
        },
        authorAvatar,
      ),
    });

    return update;
  }

  async editUpdate(id: string, orgId: string, userId: string, dto: UpdateTaskUpdateDto) {
    const existing = await this.prisma.taskUpdate.findFirst({
      where: { id, orgId, isDeleted: false },
      select: { id: true, authorId: true, body: true, issueId: true },
    });
    if (!existing) throw new NotFoundException('Task update not found');
    if (existing.authorId !== userId) throw new ForbiddenException('Not your update');

    const { mentionedUserIds: _ignored, attachments, ...fields } = dto;
    const attachmentUpdate =
      attachments !== undefined
        ? { attachments: { deleteMany: {}, create: mapImageAttachments(attachments, this.storage) } }
        : {};

    const update = await this.prisma.taskUpdate.update({
      where: { id },
      data: { ...fields, ...attachmentUpdate, isEdited: true, editedAt: new Date() },
      select: this.updateSelect,
    });

    // Only notify people newly @mentioned by this edit (present in the new body, not the old).
    const previous = new Set(extractMentionIds(existing.body));
    const newlyMentioned = extractMentionIds(update.body).filter((uid) => !previous.has(uid));
    if (newlyMentioned.length) {
      const author = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      const issue = await this.prisma.linearIssue.findUnique({
        where: { id: existing.issueId },
        select: { id: true, identifier: true },
      });
      if (author && issue) {
        await this.notifications.notifyMentions({
          mentionedUserIds: newlyMentioned,
          orgId,
          authorId: userId,
          payload: NotificationTemplates.mentioned(
            `${author.firstName} ${author.lastName}`,
            {
              surface: 'task-update',
              entityId: issue.id,
              label: issue.identifier,
              actionUrl: `/task-updates/${issue.id}`,
            },
            author.avatarUrl,
          ),
        });
      }
    }

    return update;
  }

  async deleteUpdate(id: string, orgId: string, caller: JwtPayload) {
    const existing = await this.prisma.taskUpdate.findFirst({
      where: { id, orgId, isDeleted: false },
      select: { id: true, authorId: true },
    });
    if (!existing) throw new NotFoundException('Task update not found');

    const authorManagerId = await this.getManagerUserId(existing.authorId, orgId);
    const isAuthor = existing.authorId === caller.sub;
    const isManager = authorManagerId === caller.sub;
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
    const target = await this.prisma.membership.findFirst({
      where: { userId: targetUserId, orgId },
      include: { manager: { select: { userId: true } } },
    });
    if (!target) throw new NotFoundException('User not found');

    this.assertCanView(caller, target.userId, target.manager?.userId ?? null);

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
      const reportIds = await this.getReportUserIds(caller.sub, orgId);
      if (!reportIds.length) return paginate([], 0, page, limit);
      where.authorId = { in: reportIds };
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
    const [linearStatus, aggregate, unassignedCount] = await Promise.all([
      this.linearIntegration.getStatus(orgId),
      this.prisma.linearIssue.aggregate({
        where: { orgId, archivedAt: null },
        _max: { syncedAt: true },
        _count: true,
      }),
      // Issues whose Linear assignee email never matched an active Membership - only
      // reachable via the ALL_SENTINEL/UNASSIGNED_SENTINEL filters in listMyIssues, so
      // surfaced here to explain any gap between issueCount and what a normal view shows.
      this.prisma.linearIssue.count({ where: { orgId, archivedAt: null, assigneeId: null } }),
    ]);

    return {
      linearConnected: linearStatus.connected,
      workspaceName: linearStatus.workspaceName,
      lastSyncedAt: aggregate._max.syncedAt,
      issueCount: aggregate._count,
      unassignedCount,
    };
  }
}
