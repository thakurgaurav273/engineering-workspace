import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Prisma, WorkspaceStatus, MembershipStatus } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { paginate } from "@/common/dto/pagination.dto";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { NotificationsService } from "@/platform/notifications/notifications.service";
import {
  NotificationTemplates,
  NotificationPayload,
} from "@/platform/notifications/notification-templates";
import { StorageService } from "@/platform/storage/storage.service";
import {
  ImageUploadUrlDto,
  COMMENT_IMAGE_MIME_EXT,
} from "@/platform/storage/dto/image-upload.dto";
import { extractMentionIds } from "@/common/mentions";
import { mapImageAttachments } from "@/common/attachments";
import { CreateWorkspaceItemDto } from "./dto/create-workspace-item.dto";
import { UpdateWorkspaceItemDto } from "./dto/update-workspace-item.dto";
import { UpdateWorkspaceStatusDto } from "./dto/update-workspace-status.dto";
import { ListWorkspaceItemsDto } from "./dto/list-workspace-items.dto";
import { CreateWorkspaceCommentDto } from "./dto/create-workspace-comment.dto";
import { UpdateWorkspaceCommentDto } from "./dto/update-workspace-comment.dto";
import { DelegateWorkspaceItemDto } from "./dto/delegate-workspace-item.dto";

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private storage: StorageService,
  ) {}

  /** Presigned R2 PUT URL for a workspace-comment image attachment. */
  createCommentAttachmentUploadUrl(orgId: string, dto: ImageUploadUrlDto) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException("File uploads are not available right now");
    }
    const ext = COMMENT_IMAGE_MIME_EXT[dto.contentType];
    if (!ext) throw new BadRequestException("Unsupported image type");
    const key = this.storage.buildKey(`workspace-comments/${orgId}`, ext);
    return this.storage.presignUpload({ key, contentType: dto.contentType, contentLength: dto.size });
  }

  private readonly itemSelect = {
    id: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    dueDate: true,
    source: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
    archivedAt: true,
    orgId: true,
    ownerId: true,
    assignedById: true,
    isClientProject: true,
    watcherIds: true,
    owner: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
    assignedBy: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
  };

  private readonly commentSelect = {
    id: true,
    body: true,
    isEdited: true,
    editedAt: true,
    createdAt: true,
    author: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
    attachments: {
      select: { id: true, url: true, fileName: true, mimeType: true, sizeBytes: true, kind: true },
    },
  };

  private startOfToday(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private endOfToday(): Date {
    const d = this.startOfToday();
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  // OWNER/ADMIN can assign to anyone in the org. Anyone else can only assign to
  // their own direct reports (Membership.managerId, scoped to this org), matching
  // the hierarchy already used for Linear task-update visibility - there is no
  // separate MANAGER role.
  private async assertCanAssign(caller: JwtPayload, targetUserId: string): Promise<void> {
    if (targetUserId === caller.sub) return;

    const target = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId: caller.orgId } },
      include: { manager: { select: { userId: true } } },
    });
    if (!target) throw new NotFoundException("User not found");

    if (caller.role === "OWNER" || caller.role === "ADMIN") return;
    if (target.manager?.userId === caller.sub) return;

    throw new ForbiddenException("You can only create action items for your direct reports");
  }

  // Access to a single item (view/edit/delete/move) is limited to its owner, whoever
  // assigned it, or an org OWNER/ADMIN - never a bystander, even a manager who didn't
  // assign it (see spec: "Managers can only see items they assigned").
  private assertHasAccess(
    caller: JwtPayload,
    item: { ownerId: string; assignedById: string | null },
  ): void {
    const isOwner = item.ownerId === caller.sub;
    const isAssigner = item.assignedById === caller.sub;
    const isAdmin = caller.role === "OWNER" || caller.role === "ADMIN";
    if (!isOwner && !isAssigner && !isAdmin) {
      throw new ForbiddenException("You do not have access to this action item");
    }
  }

  // Fans a notification out to everyone with a stake in this item - its owner, whoever
  // assigned it, and every past owner/assigner accumulated via delegation - minus
  // whoever just triggered the event. This is what lets a status change or comment from
  // a re-delegated junior reach both their immediate senior and the original assigner.
  private async notifyWatchers(
    item: { ownerId: string; assignedById: string | null; watcherIds: string[] },
    actorId: string,
    orgId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const recipients = new Set<string>([
      item.ownerId,
      ...(item.assignedById ? [item.assignedById] : []),
      ...(item.watcherIds ?? []),
    ]);
    recipients.delete(actorId);
    if (!recipients.size) return;

    await Promise.allSettled(
      Array.from(recipients).map((userId) =>
        this.notifications.notify({ userId, orgId, ...payload }),
      ),
    );
  }

  private async findActiveOrThrow(id: string, orgId: string) {
    const item = await this.prisma.workspaceItem.findFirst({
      where: { id, orgId, deletedAt: null },
    });
    if (!item) throw new NotFoundException("Action item not found");
    return item;
  }

  async create(caller: JwtPayload, dto: CreateWorkspaceItemDto) {
    const ownerId = dto.ownerId ?? caller.sub;
    await this.assertCanAssign(caller, ownerId);
    const isAssigningToOther = ownerId !== caller.sub;

    const item = await this.prisma.workspaceItem.create({
      data: {
        orgId: caller.orgId,
        ownerId,
        assignedById: isAssigningToOther ? caller.sub : null,
        title: dto.title,
        description: dto.description,
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.source && { source: dto.source }),
        ...(dto.isClientProject !== undefined && { isClientProject: dto.isClientProject }),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      select: this.itemSelect,
    });

    this.logger.log(`Action item created: ${item.id} for user ${ownerId}`);

    if (isAssigningToOther) {
      const assigner = await this.prisma.user.findUnique({
        where: { id: caller.sub },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      if (assigner) {
        const payload = NotificationTemplates.workspaceItemAssigned(
          `${assigner.firstName} ${assigner.lastName}`,
          item.id,
          item.title,
          assigner.avatarUrl,
        );
        await this.notifications.notify({ userId: ownerId, orgId: caller.orgId, ...payload });
      }
    }

    return item;
  }

  async update(id: string, caller: JwtPayload, dto: UpdateWorkspaceItemDto) {
    const existing = await this.findActiveOrThrow(id, caller.orgId);
    this.assertHasAccess(caller, existing);

    const dueDateProvided = dto.dueDate !== undefined;

    // When an item was assigned by someone else, only that assigner (or an admin) may
    // move the due date - the assignee must deliver against the date they were given.
    if (dueDateProvided) {
      const nextDue = dto.dueDate ? new Date(dto.dueDate).getTime() : null;
      const currentDue = existing.dueDate ? existing.dueDate.getTime() : null;
      const dueDateChanged = nextDue !== currentDue;
      const isAssigner = existing.assignedById === caller.sub;
      const isAdmin = caller.role === "OWNER" || caller.role === "ADMIN";
      if (dueDateChanged && existing.assignedById && !isAssigner && !isAdmin) {
        throw new ForbiddenException(
          "Only the person who assigned this item can change its due date",
        );
      }
    }

    return this.prisma.workspaceItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.isClientProject !== undefined && { isClientProject: dto.isClientProject }),
        // Due date changed - give reminders a fresh chance to fire against the new date.
        ...(dueDateProvided && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          reminderStage: "NONE" as const,
        }),
      },
      select: this.itemSelect,
    });
  }

  async updateStatus(id: string, caller: JwtPayload, dto: UpdateWorkspaceStatusDto) {
    const existing = await this.findActiveOrThrow(id, caller.orgId);
    this.assertHasAccess(caller, existing);

    const data: Prisma.WorkspaceItemUpdateInput = { status: dto.status };
    if (dto.status === WorkspaceStatus.DONE && existing.status !== WorkspaceStatus.DONE) {
      data.completedAt = new Date();
    } else if (dto.status !== WorkspaceStatus.DONE) {
      data.completedAt = null;
    }

    const updated = await this.prisma.workspaceItem.update({
      where: { id },
      data,
      select: this.itemSelect,
    });

    if (dto.status !== existing.status) {
      const actor = await this.prisma.user.findUnique({
        where: { id: caller.sub },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      if (actor) {
        const payload = NotificationTemplates.workspaceItemStatusChanged(
          `${actor.firstName} ${actor.lastName}`,
          id,
          updated.title,
          dto.status,
          actor.avatarUrl,
        );
        await this.notifyWatchers(existing, caller.sub, caller.orgId, payload);
      }
    }

    return updated;
  }

  async archive(id: string, caller: JwtPayload) {
    const existing = await this.findActiveOrThrow(id, caller.orgId);
    this.assertHasAccess(caller, existing);
    if (existing.status !== WorkspaceStatus.DONE) {
      throw new BadRequestException("Only completed items can be archived");
    }

    return this.prisma.workspaceItem.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: this.itemSelect,
    });
  }

  async remove(id: string, caller: JwtPayload) {
    const existing = await this.findActiveOrThrow(id, caller.orgId);
    this.assertHasAccess(caller, existing);

    await this.prisma.workspaceItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: "Action item deleted" };
  }

  async findOne(id: string, caller: JwtPayload) {
    const existing = await this.findActiveOrThrow(id, caller.orgId);
    this.assertHasAccess(caller, existing);

    return this.prisma.workspaceItem.findFirst({
      where: { id, orgId: caller.orgId },
      select: this.itemSelect,
    });
  }

  private applyListFilters(
    where: Prisma.WorkspaceItemWhereInput,
    query: Pick<
      ListWorkspaceItemsDto,
      "search" | "status" | "priority" | "source" | "overdue" | "dueToday" | "includeArchived"
    >,
  ): void {
    const { search, status, priority, source, overdue, dueToday, includeArchived } = query;
    if (!includeArchived) where.archivedAt = null;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (overdue) {
      where.dueDate = { lt: this.startOfToday() };
      where.status = { not: WorkspaceStatus.DONE };
    } else if (dueToday) {
      where.dueDate = { gte: this.startOfToday(), lt: this.endOfToday() };
    }
  }

  async findMine(caller: JwtPayload, query: ListWorkspaceItemsDto) {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = query;

    const where: Prisma.WorkspaceItemWhereInput = {
      orgId: caller.orgId,
      ownerId: caller.sub,
      deletedAt: null,
    };
    this.applyListFilters(where, query);

    const [data, total] = await Promise.all([
      this.prisma.workspaceItem.findMany({
        where,
        select: this.itemSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.workspaceItem.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // Items this caller has delegated to someone else - so an assigner can see what's
  // already been handed off before creating a duplicate for the same work. Deliberately
  // NOT scoped to ownerId: these items live in the assignee's board, not the caller's.
  async findAssignedByMe(caller: JwtPayload, query: ListWorkspaceItemsDto) {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = query;

    const where: Prisma.WorkspaceItemWhereInput = {
      orgId: caller.orgId,
      assignedById: caller.sub,
      deletedAt: null,
    };
    this.applyListFilters(where, query);

    const [data, total] = await Promise.all([
      this.prisma.workspaceItem.findMany({
        where,
        select: this.itemSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.workspaceItem.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // Kanban board view - the three columns fetched in parallel so no single column can
  // starve the others the way one combined `take` would. search/priority/source are
  // applied in the WHERE clause (not after fetching) so a search narrowing a column to
  // under `take` still returns every match, instead of matches beyond the first 200
  // unfiltered rows getting silently dropped.
  async getBoard(caller: JwtPayload, query: Pick<ListWorkspaceItemsDto, "search" | "priority" | "source"> = {}) {
    const baseWhere: Prisma.WorkspaceItemWhereInput = {
      orgId: caller.orgId,
      ownerId: caller.sub,
      deletedAt: null,
      archivedAt: null,
    };
    this.applyListFilters(baseWhere, query);

    const [pending, inProgress, done] = await Promise.all([
      this.prisma.workspaceItem.findMany({
        where: { ...baseWhere, status: WorkspaceStatus.PENDING },
        select: this.itemSelect,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
      this.prisma.workspaceItem.findMany({
        where: { ...baseWhere, status: WorkspaceStatus.IN_PROGRESS },
        select: this.itemSelect,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
      this.prisma.workspaceItem.findMany({
        where: { ...baseWhere, status: WorkspaceStatus.DONE },
        select: this.itemSelect,
        orderBy: { completedAt: "desc" },
        take: 200,
      }),
    ]);

    return { PENDING: pending, IN_PROGRESS: inProgress, DONE: done };
  }

  async getSummary(caller: JwtPayload, targetUserId?: string) {
    const userId = targetUserId ?? caller.sub;
    const isSelf = userId === caller.sub;
    const isAdmin = caller.role === "OWNER" || caller.role === "ADMIN";

    const baseWhere: Prisma.WorkspaceItemWhereInput = {
      orgId: caller.orgId,
      ownerId: userId,
      deletedAt: null,
    };

    if (!isSelf && !isAdmin) {
      const target = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId, orgId: caller.orgId } },
        include: { manager: { select: { userId: true } } },
      });
      if (!target) throw new NotFoundException("User not found");
      if (target.manager?.userId !== caller.sub) {
        throw new ForbiddenException("You do not have access to this person's workspace");
      }
      // A manager only ever sees the items they personally assigned to this report.
      baseWhere.assignedById = caller.sub;
    }

    const todayStart = this.startOfToday();
    const todayEnd = this.endOfToday();

    const [pending, inProgress, done, overdue, dueToday, total] = await Promise.all([
      this.prisma.workspaceItem.count({ where: { ...baseWhere, status: WorkspaceStatus.PENDING } }),
      this.prisma.workspaceItem.count({
        where: { ...baseWhere, status: WorkspaceStatus.IN_PROGRESS },
      }),
      this.prisma.workspaceItem.count({ where: { ...baseWhere, status: WorkspaceStatus.DONE } }),
      this.prisma.workspaceItem.count({
        where: { ...baseWhere, status: { not: WorkspaceStatus.DONE }, dueDate: { lt: todayStart } },
      }),
      this.prisma.workspaceItem.count({
        where: { ...baseWhere, dueDate: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.workspaceItem.count({ where: baseWhere }),
    ]);

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { pending, inProgress, done, overdue, dueToday, total, completionRate };
  }

  async listComments(itemId: string, caller: JwtPayload) {
    const item = await this.findActiveOrThrow(itemId, caller.orgId);
    this.assertHasAccess(caller, item);

    return this.prisma.workspaceItemComment.findMany({
      where: { itemId },
      select: this.commentSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async addComment(itemId: string, caller: JwtPayload, dto: CreateWorkspaceCommentDto) {
    const item = await this.findActiveOrThrow(itemId, caller.orgId);
    this.assertHasAccess(caller, item);

    const attachmentRows = mapImageAttachments(dto.attachments, this.storage);
    const comment = await this.prisma.workspaceItemComment.create({
      data: {
        itemId,
        authorId: caller.sub,
        body: dto.body,
        ...(attachmentRows.length && { attachments: { create: attachmentRows } }),
      },
      select: this.commentSelect,
    });

    const author = await this.prisma.user.findUnique({
      where: { id: caller.sub },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    if (author) {
      const authorName = `${author.firstName} ${author.lastName}`;
      const payload = NotificationTemplates.workspaceItemComment(
        authorName,
        itemId,
        item.title,
        author.avatarUrl,
      );
      await this.notifyWatchers(item, caller.sub, caller.orgId, payload);

      // Notify @mentioned members not already covered by the watcher fan-out above.
      const alreadyNotified = [
        item.ownerId,
        ...(item.assignedById ? [item.assignedById] : []),
        ...(item.watcherIds ?? []),
      ];
      await this.notifications.notifyMentions({
        mentionedUserIds: extractMentionIds(dto.body),
        orgId: caller.orgId,
        authorId: caller.sub,
        excludeUserIds: alreadyNotified,
        payload: NotificationTemplates.mentioned(
          authorName,
          {
            surface: "workspace-item",
            entityId: itemId,
            label: item.title,
            actionUrl: `/workspace/${itemId}`,
          },
          author.avatarUrl,
        ),
      });
    }

    return comment;
  }

  async editComment(
    itemId: string,
    commentId: string,
    caller: JwtPayload,
    dto: UpdateWorkspaceCommentDto,
  ) {
    const item = await this.findActiveOrThrow(itemId, caller.orgId);
    this.assertHasAccess(caller, item);

    const existing = await this.prisma.workspaceItemComment.findFirst({
      where: { id: commentId, itemId },
      select: { id: true, authorId: true, body: true },
    });
    if (!existing) throw new NotFoundException("Comment not found");
    if (existing.authorId !== caller.sub) throw new ForbiddenException("Not your comment");

    const attachmentUpdate =
      dto.attachments !== undefined
        ? { attachments: { deleteMany: {}, create: mapImageAttachments(dto.attachments, this.storage) } }
        : {};

    const comment = await this.prisma.workspaceItemComment.update({
      where: { id: commentId },
      data: {
        ...(dto.body !== undefined && { body: dto.body }),
        ...attachmentUpdate,
        isEdited: true,
        editedAt: new Date(),
      },
      select: this.commentSelect,
    });

    // Notify only people newly @mentioned by this edit.
    const previous = new Set(extractMentionIds(existing.body));
    const newlyMentioned = extractMentionIds(dto.body ?? existing.body).filter(
      (uid) => !previous.has(uid),
    );
    if (newlyMentioned.length) {
      const author = await this.prisma.user.findUnique({
        where: { id: caller.sub },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      if (author) {
        await this.notifications.notifyMentions({
          mentionedUserIds: newlyMentioned,
          orgId: caller.orgId,
          authorId: caller.sub,
          payload: NotificationTemplates.mentioned(
            `${author.firstName} ${author.lastName}`,
            {
              surface: "workspace-item",
              entityId: itemId,
              label: item.title,
              actionUrl: `/workspace/${itemId}`,
            },
            author.avatarUrl,
          ),
        });
      }
    }

    return comment;
  }

  async deleteComment(itemId: string, commentId: string, caller: JwtPayload) {
    const item = await this.findActiveOrThrow(itemId, caller.orgId);
    this.assertHasAccess(caller, item);

    const existing = await this.prisma.workspaceItemComment.findFirst({
      where: { id: commentId, itemId },
      select: { id: true, authorId: true },
    });
    if (!existing) throw new NotFoundException("Comment not found");

    const isAuthor = existing.authorId === caller.sub;
    const isAdmin = caller.role === "OWNER" || caller.role === "ADMIN";
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException("You cannot delete this comment");
    }

    await this.prisma.workspaceItemComment.delete({ where: { id: commentId } });
    return { message: "Comment deleted" };
  }

  // Hands the item off to someone else - e.g. a senior passing an admin-assigned item
  // down to a junior. The outgoing owner and assigner are folded into watcherIds first,
  // so they keep getting notified on future status changes/comments even though
  // assignedById is about to be overwritten with the delegator's own id.
  //
  // Any member who currently holds the item (or an OWNER/ADMIN) can delegate it to
  // any other active member of the org - unlike assertCanAssign (used when creating
  // items), delegation isn't limited to direct reports, since the delegator already
  // owns the item and is simply handing off work they're responsible for.
  async delegate(id: string, caller: JwtPayload, dto: DelegateWorkspaceItemDto) {
    const existing = await this.findActiveOrThrow(id, caller.orgId);

    const isOwner = existing.ownerId === caller.sub;
    const isAdmin = caller.role === "OWNER" || caller.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException("Only the current owner can delegate this item");
    }
    if (dto.ownerId === existing.ownerId) {
      throw new BadRequestException("Item is already assigned to that person");
    }

    const target = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: dto.ownerId, orgId: caller.orgId } },
    });
    if (!target || target.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException("User not found");
    }

    const watchers = new Set(existing.watcherIds ?? []);
    watchers.add(existing.ownerId);
    if (existing.assignedById) watchers.add(existing.assignedById);
    watchers.delete(dto.ownerId);

    const updated = await this.prisma.workspaceItem.update({
      where: { id },
      data: {
        ownerId: dto.ownerId,
        assignedById: caller.sub,
        watcherIds: Array.from(watchers),
      },
      select: this.itemSelect,
    });

    const delegator = await this.prisma.user.findUnique({
      where: { id: caller.sub },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    if (delegator) {
      const payload = NotificationTemplates.workspaceItemAssigned(
        `${delegator.firstName} ${delegator.lastName}`,
        id,
        updated.title,
        delegator.avatarUrl,
      );
      await this.notifications.notify({ userId: dto.ownerId, orgId: caller.orgId, ...payload });
    }

    return updated;
  }
}
