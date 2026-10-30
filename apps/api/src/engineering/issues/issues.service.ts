import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { IssuePriority, IssueStatus, Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { paginate } from "@/common/dto/pagination.dto";
import { extractMentionIds } from "@/common/mentions";
import { NotificationsService } from "@/platform/notifications/notifications.service";
import { NotificationTemplates } from "@/platform/notifications/notification-templates";
import { CreateIssueDto, IssueCommentDto, ListIssuesDto, UpdateIssueDto } from "./dto/issue.dto";
import { IssueAccess, isOrgAdmin, personSelect } from "./issue-access";

export const OPEN_STATUSES: IssueStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW"];

export const STATUS_LABEL: Record<IssueStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  CANCELED: "Canceled",
};

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  NONE: "No priority",
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

// Linear sorts "No priority" last, which the Postgres enum order (NONE first) can't express.
const PRIORITY_RANK: Record<IssuePriority, number> = {
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  NONE: 5,
};

const IDENTIFIER = /^([A-Za-z0-9]{2,10})-(\d+)$/;

const issueSelect = {
  id: true,
  orgId: true,
  teamId: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  estimate: true,
  dueDate: true,
  sortOrder: true,
  creatorId: true,
  assigneeId: true,
  projectId: true,
  cycleId: true,
  parentId: true,
  startedAt: true,
  completedAt: true,
  canceledAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  team: { select: { id: true, key: true, name: true } },
  assignee: { select: personSelect },
  creator: { select: personSelect },
  project: { select: { id: true, name: true } },
  cycle: { select: { id: true, number: true, name: true } },
  parent: { select: { id: true, number: true, title: true, team: { select: { key: true } } } },
  labels: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" as const } },
  _count: { select: { children: { where: { deletedAt: null } } } },
} satisfies Prisma.IssueSelect;

type IssueRow = Prisma.IssueGetPayload<{ select: typeof issueSelect }>;

const commentSelect = {
  id: true,
  issueId: true,
  body: true,
  createdAt: true,
  editedAt: true,
  author: { select: personSelect },
} satisfies Prisma.IssueCommentSelect;

type ActivityEntry = { field: string; fromValue?: string | null; toValue?: string | null };

function withIdentifier<T extends IssueRow>(issue: T) {
  const { parent, ...rest } = issue;
  return {
    ...rest,
    identifier: `${issue.team.key}-${issue.number}`,
    parent: parent
      ? { id: parent.id, title: parent.title, identifier: `${parent.team.key}-${parent.number}` }
      : null,
  };
}

function fullName(p: { firstName: string; lastName: string } | null | undefined) {
  return p ? `${p.firstName} ${p.lastName}`.trim() : null;
}

function sameDay(a: Date | null, b: Date | null) {
  return (a?.toISOString().slice(0, 10) ?? null) === (b?.toISOString().slice(0, 10) ?? null);
}

/** Lifecycle timestamps implied by moving an issue into `status`. */
function statusTimestamps(status: IssueStatus, current?: { startedAt: Date | null }) {
  const now = new Date();
  const started = current?.startedAt ?? now;
  switch (status) {
    case "IN_PROGRESS":
    case "IN_REVIEW":
      return { startedAt: started, completedAt: null, canceledAt: null };
    case "DONE":
      return { startedAt: started, completedAt: now, canceledAt: null };
    case "CANCELED":
      return { canceledAt: now, completedAt: null };
    default:
      return { completedAt: null, canceledAt: null };
  }
}

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private prisma: PrismaService,
    private access: IssueAccess,
    private notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- reads

  async list(caller: JwtPayload, query: ListIssuesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 250;
    const where = await this.buildWhere(caller, query);

    const order = query.orderBy ?? "manual";
    const orderBy: Prisma.IssueOrderByWithRelationInput[] =
      order === "updated"
        ? [{ updatedAt: "desc" }]
        : order === "created"
          ? [{ createdAt: "desc" }]
          : order === "dueDate"
            ? [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
            : [{ sortOrder: "asc" }, { createdAt: "desc" }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.issue.findMany({
        where,
        select: issueSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.issue.count({ where }),
    ]);

    const data = rows.map(withIdentifier);
    if (order === "priority") {
      // Stable: rows are already in manual order, so ties keep it.
      data.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    }
    return paginate(data, total, page, limit);
  }

  private async buildWhere(caller: JwtPayload, q: ListIssuesDto): Promise<Prisma.IssueWhereInput> {
    const and: Prisma.IssueWhereInput[] = [];
    const where: Prisma.IssueWhereInput = {
      orgId: caller.orgId,
      deletedAt: null,
      archivedAt: q.archived ? { not: null } : null,
      team: { archivedAt: null },
      AND: and,
    };

    if (q.teamId) where.teamId = q.teamId;
    if (q.status?.length) where.status = { in: q.status };
    else if (q.activeOnly) where.status = { in: OPEN_STATUSES };
    if (q.priority?.length) where.priority = { in: q.priority };

    if (q.assigneeId === "me") where.assigneeId = caller.sub;
    else if (q.assigneeId === "none") where.assigneeId = null;
    else if (q.assigneeId) where.assigneeId = q.assigneeId;

    if (q.creatorId) where.creatorId = q.creatorId === "me" ? caller.sub : q.creatorId;

    if (q.projectId === "none") where.projectId = null;
    else if (q.projectId) where.projectId = q.projectId;

    if (q.cycleId === "none") where.cycleId = null;
    else if (q.cycleId === "current") {
      if (!q.teamId) throw new BadRequestException('cycleId "current" requires teamId');
      const current = await this.currentCycle(q.teamId);
      // No active cycle: match nothing rather than everything.
      where.cycleId = current?.id ?? "__none__";
    } else if (q.cycleId) where.cycleId = q.cycleId;

    if (q.labelId) and.push({ labels: { some: { id: q.labelId } } });
    if (q.parentId) where.parentId = q.parentId;
    if (q.topLevelOnly) where.parentId = null;

    const search = q.search?.trim();
    if (search) {
      const ident = search.match(IDENTIFIER);
      const or: Prisma.IssueWhereInput[] = [{ title: { contains: search, mode: "insensitive" } }];
      if (ident) {
        or.push({ team: { key: ident[1].toUpperCase() }, number: Number(ident[2]) });
      } else if (/^\d+$/.test(search)) {
        or.push({ number: Number(search) });
      }
      and.push({ OR: or });
    }
    return where;
  }

  currentCycle(teamId: string) {
    const now = new Date();
    return this.prisma.cycle.findFirst({
      where: { teamId, startsAt: { lte: now }, endsAt: { gt: now }, completedAt: null },
      orderBy: { startsAt: "desc" },
    });
  }

  /** Accepts a cuid or a human identifier such as "ENG-42". */
  private async resolve(idOrIdentifier: string, orgId: string) {
    const ident = idOrIdentifier.match(IDENTIFIER);
    const issue = await this.prisma.issue.findFirst({
      where: ident
        ? { orgId, deletedAt: null, team: { key: ident[1].toUpperCase() }, number: Number(ident[2]) }
        : { id: idOrIdentifier, orgId, deletedAt: null },
      include: { labels: { select: { id: true, name: true } }, team: { select: { key: true } } },
    });
    if (!issue) throw new NotFoundException("Issue not found");
    return issue;
  }

  async findOne(idOrIdentifier: string, caller: JwtPayload) {
    const { id } = await this.resolve(idOrIdentifier, caller.orgId);
    const [issue, description, subIssues, activity] = await Promise.all([
      this.prisma.issue.findUniqueOrThrow({ where: { id }, select: issueSelect }),
      this.prisma.issue.findUniqueOrThrow({ where: { id }, select: { description: true } }),
      this.prisma.issue.findMany({
        where: { parentId: id, deletedAt: null },
        select: issueSelect,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.issueActivity.findMany({
        where: { issueId: id },
        orderBy: { createdAt: "asc" },
        include: { actor: { select: personSelect } },
      }),
    ]);
    const done = subIssues.filter((s) => s.status === "DONE").length;
    return {
      ...withIdentifier(issue),
      description: description.description,
      subIssues: subIssues.map(withIdentifier),
      subIssueProgress: { done, total: subIssues.length },
      activity,
    };
  }

  /** Compact feed for My Workspace: open issues on my plate and ones I handed to others. */
  async mine(caller: JwtPayload) {
    const base: Prisma.IssueWhereInput = {
      orgId: caller.orgId,
      deletedAt: null,
      archivedAt: null,
      status: { in: OPEN_STATUSES },
      team: { archivedAt: null },
    };
    const [assigned, delegated] = await Promise.all([
      this.prisma.issue.findMany({
        where: { ...base, assigneeId: caller.sub },
        select: issueSelect,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 100,
      }),
      this.prisma.issue.findMany({
        where: { ...base, creatorId: caller.sub, assigneeId: { not: caller.sub }, NOT: { assigneeId: null } },
        select: issueSelect,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 100,
      }),
    ]);
    const byPriority = (a: IssueRow, b: IssueRow) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return {
      assigned: assigned.sort(byPriority).map(withIdentifier),
      delegated: delegated.sort(byPriority).map(withIdentifier),
    };
  }

  // ---------------------------------------------------------------- writes

  async create(caller: JwtPayload, dto: CreateIssueDto) {
    await this.access.team(dto.teamId, caller.orgId);
    const refs = await this.validateRefs(caller, dto.teamId, dto);
    const status = dto.status ?? "TODO";

    const top = await this.prisma.issue.aggregate({
      where: { teamId: dto.teamId, status, deletedAt: null },
      _min: { sortOrder: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: dto.teamId },
        data: { issueCounter: { increment: 1 } },
        select: { issueCounter: true },
      });
      const issue = await tx.issue.create({
        data: {
          orgId: caller.orgId,
          teamId: dto.teamId,
          number: team.issueCounter,
          title: dto.title.trim(),
          description: dto.description,
          status,
          priority: dto.priority ?? "NONE",
          estimate: dto.estimate ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          sortOrder: (top._min.sortOrder ?? 0) - 1,
          creatorId: caller.sub,
          assigneeId: dto.assigneeId ?? null,
          projectId: dto.projectId ?? null,
          cycleId: dto.cycleId ?? null,
          parentId: dto.parentId ?? null,
          ...statusTimestamps(status),
          ...(dto.labelIds?.length && { labels: { connect: dto.labelIds.map((id) => ({ id })) } }),
        },
        select: issueSelect,
      });
      await tx.issueActivity.create({
        data: { issueId: issue.id, actorId: caller.sub, field: "created" },
      });
      if (refs.project) await this.linkProjectToTeam(tx, refs.project.id, dto.teamId);
      return issue;
    });

    const issue = withIdentifier(created);
    if (issue.assigneeId && issue.assigneeId !== caller.sub) {
      const actor = await this.actor(caller.sub);
      await this.safeNotify({
        userId: issue.assigneeId,
        orgId: caller.orgId,
        ...NotificationTemplates.issueAssigned(
          actor.name,
          issue.id,
          issue.identifier,
          issue.title,
          actor.avatarUrl,
        ),
      });
    }
    this.logger.log(`Issue created: ${issue.identifier} (${issue.id})`);
    return issue;
  }

  async update(idOrIdentifier: string, caller: JwtPayload, dto: UpdateIssueDto) {
    const existing = await this.resolve(idOrIdentifier, caller.orgId);
    const teamId = dto.teamId ?? existing.teamId;
    const movingTeam = teamId !== existing.teamId;
    if (movingTeam) await this.access.team(teamId, caller.orgId);

    const refs = await this.validateRefs(caller, teamId, dto, existing.id);
    const data: Prisma.IssueUncheckedUpdateInput = {};
    const log: ActivityEntry[] = [];

    if (dto.title !== undefined && dto.title.trim() !== existing.title) {
      data.title = dto.title.trim();
      log.push({ field: "title", fromValue: existing.title, toValue: data.title as string });
    }
    if (dto.description !== undefined && dto.description !== existing.description) {
      data.description = dto.description;
      log.push({ field: "description" });
    }
    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      Object.assign(data, statusTimestamps(dto.status, existing));
      log.push({ field: "status", fromValue: STATUS_LABEL[existing.status], toValue: STATUS_LABEL[dto.status] });
    }
    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      data.priority = dto.priority;
      log.push({
        field: "priority",
        fromValue: PRIORITY_LABEL[existing.priority],
        toValue: PRIORITY_LABEL[dto.priority],
      });
    }
    if (dto.estimate !== undefined && dto.estimate !== existing.estimate) {
      data.estimate = dto.estimate;
      log.push({ field: "estimate", fromValue: existing.estimate?.toString(), toValue: dto.estimate?.toString() });
    }
    if (dto.dueDate !== undefined) {
      const next = dto.dueDate ? new Date(dto.dueDate) : null;
      if (!sameDay(next, existing.dueDate)) {
        data.dueDate = next;
        log.push({
          field: "dueDate",
          fromValue: existing.dueDate?.toISOString().slice(0, 10),
          toValue: next?.toISOString().slice(0, 10),
        });
      }
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== existing.assigneeId) {
      data.assigneeId = dto.assigneeId;
      const [from, to] = await Promise.all([
        existing.assigneeId ? this.actor(existing.assigneeId) : null,
        refs.assignee ? Promise.resolve(refs.assignee) : null,
      ]);
      log.push({ field: "assignee", fromValue: from?.name, toValue: to?.name });
    }
    if (dto.projectId !== undefined && dto.projectId !== existing.projectId) {
      data.projectId = dto.projectId;
      const from = existing.projectId
        ? await this.prisma.project.findUnique({ where: { id: existing.projectId }, select: { name: true } })
        : null;
      log.push({ field: "project", fromValue: from?.name, toValue: refs.project?.name });
    }
    if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
      data.parentId = dto.parentId;
      log.push({ field: "parent", fromValue: null, toValue: refs.parent?.identifier ?? null });
    }

    // Cycles and team-scoped labels belong to a team, so a team move drops whatever
    // doesn't carry over, then takes the new number (ENG-12 -> PLT-3) like Linear.
    let cycleId = dto.cycleId !== undefined ? dto.cycleId : existing.cycleId;
    if (movingTeam && cycleId && dto.cycleId === undefined) cycleId = null;
    if (cycleId !== existing.cycleId) {
      data.cycleId = cycleId;
      log.push({ field: "cycle", fromValue: null, toValue: refs.cycle ? this.cycleLabel(refs.cycle) : null });
    }

    let labelIds = dto.labelIds ?? existing.labels.map((l) => l.id);
    if (movingTeam && dto.labelIds === undefined) {
      const keep = await this.prisma.issueLabel.findMany({
        where: { id: { in: labelIds }, OR: [{ teamId: null }, { teamId }] },
        select: { id: true },
      });
      labelIds = keep.map((l) => l.id);
    }
    const prevLabels = existing.labels.map((l) => l.id).sort().join(",");
    if ([...labelIds].sort().join(",") !== prevLabels) {
      data.labels = { set: labelIds.map((id) => ({ id })) };
      const names = await this.prisma.issueLabel.findMany({
        where: { id: { in: labelIds } },
        select: { name: true },
      });
      log.push({
        field: "labels",
        fromValue: existing.labels.map((l) => l.name).join(", ") || null,
        toValue: names.map((l) => l.name).join(", ") || null,
      });
    }

    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (movingTeam) {
        const team = await tx.team.update({
          where: { id: teamId },
          data: { issueCounter: { increment: 1 } },
          select: { issueCounter: true, key: true },
        });
        data.teamId = teamId;
        data.number = team.issueCounter;
        log.push({
          field: "team",
          fromValue: `${existing.team.key}-${existing.number}`,
          toValue: `${team.key}-${team.issueCounter}`,
        });
      }
      const issue = await tx.issue.update({ where: { id: existing.id }, data, select: issueSelect });
      if (log.length) {
        await tx.issueActivity.createMany({
          data: log.map((entry) => ({ issueId: existing.id, actorId: caller.sub, ...entry })),
        });
      }
      const projectId = dto.projectId !== undefined ? dto.projectId : existing.projectId;
      if (projectId && (movingTeam || dto.projectId)) await this.linkProjectToTeam(tx, projectId, teamId);
      return issue;
    });

    const issue = withIdentifier(updated);
    await this.notifyChanges(caller, existing, issue, dto);
    return issue;
  }

  async setArchived(idOrIdentifier: string, caller: JwtPayload, archived: boolean) {
    const existing = await this.resolve(idOrIdentifier, caller.orgId);
    const issue = await this.prisma.issue.update({
      where: { id: existing.id },
      data: { archivedAt: archived ? new Date() : null },
      select: issueSelect,
    });
    await this.prisma.issueActivity.create({
      data: { issueId: existing.id, actorId: caller.sub, field: archived ? "archived" : "unarchived" },
    });
    return withIdentifier(issue);
  }

  async remove(idOrIdentifier: string, caller: JwtPayload) {
    const existing = await this.resolve(idOrIdentifier, caller.orgId);
    if (existing.creatorId !== caller.sub && !isOrgAdmin(caller)) {
      await this.access.assertCanManageTeam(caller, existing.teamId).catch(() => {
        throw new ForbiddenException("Only the creator, a team lead or an admin can delete this issue");
      });
    }
    await this.prisma.$transaction([
      // Sub-issues survive as top-level issues rather than vanishing with the parent.
      this.prisma.issue.updateMany({ where: { parentId: existing.id }, data: { parentId: null } }),
      this.prisma.issue.update({ where: { id: existing.id }, data: { deletedAt: new Date() } }),
    ]);
    return { message: "Issue deleted" };
  }

  // ---------------------------------------------------------------- comments

  async listComments(idOrIdentifier: string, caller: JwtPayload) {
    const { id } = await this.resolve(idOrIdentifier, caller.orgId);
    return this.prisma.issueComment.findMany({
      where: { issueId: id },
      orderBy: { createdAt: "asc" },
      select: commentSelect,
    });
  }

  async addComment(idOrIdentifier: string, caller: JwtPayload, dto: IssueCommentDto) {
    const issue = await this.resolve(idOrIdentifier, caller.orgId);
    const comment = await this.prisma.issueComment.create({
      data: { issueId: issue.id, authorId: caller.sub, body: dto.body },
      select: commentSelect,
    });

    const identifier = `${issue.team.key}-${issue.number}`;
    const actor = await this.actor(caller.sub);
    const previous = await this.prisma.issueComment.findMany({
      where: { issueId: issue.id },
      select: { authorId: true },
      distinct: ["authorId"],
    });
    // Creator, assignee and everyone already in the thread - Linear's implicit subscribers.
    const subscribers = new Set(
      [issue.creatorId, issue.assigneeId, ...previous.map((c) => c.authorId)].filter(
        (id): id is string => !!id && id !== caller.sub,
      ),
    );
    await Promise.all(
      [...subscribers].map((userId) =>
        this.safeNotify({
          userId,
          orgId: caller.orgId,
          ...NotificationTemplates.issueComment(actor.name, issue.id, identifier, issue.title, actor.avatarUrl),
        }),
      ),
    );
    await this.notifyMentioned(caller, issue, identifier, extractMentionIds(dto.body), [...subscribers]);
    return comment;
  }

  async editComment(idOrIdentifier: string, commentId: string, caller: JwtPayload, dto: IssueCommentDto) {
    const issue = await this.resolve(idOrIdentifier, caller.orgId);
    const existing = await this.prisma.issueComment.findFirst({ where: { id: commentId, issueId: issue.id } });
    if (!existing) throw new NotFoundException("Comment not found");
    if (existing.authorId !== caller.sub) throw new ForbiddenException("You can only edit your own comments");

    const comment = await this.prisma.issueComment.update({
      where: { id: commentId },
      data: { body: dto.body, editedAt: new Date() },
      select: commentSelect,
    });
    const before = new Set(extractMentionIds(existing.body));
    const added = extractMentionIds(dto.body).filter((id) => !before.has(id));
    await this.notifyMentioned(caller, issue, `${issue.team.key}-${issue.number}`, added, []);
    return comment;
  }

  async deleteComment(idOrIdentifier: string, commentId: string, caller: JwtPayload) {
    const issue = await this.resolve(idOrIdentifier, caller.orgId);
    const existing = await this.prisma.issueComment.findFirst({ where: { id: commentId, issueId: issue.id } });
    if (!existing) throw new NotFoundException("Comment not found");
    if (existing.authorId !== caller.sub && !isOrgAdmin(caller)) {
      throw new ForbiddenException("You can only delete your own comments");
    }
    await this.prisma.issueComment.delete({ where: { id: commentId } });
    return { message: "Comment deleted" };
  }

  // ---------------------------------------------------------------- helpers

  /** Validates every referenced id against the org (and the issue's team where scoped). */
  private async validateRefs(
    caller: JwtPayload,
    teamId: string,
    dto: Partial<CreateIssueDto>,
    selfId?: string,
  ) {
    const orgId = caller.orgId;
    const refs: {
      assignee?: { name: string; avatarUrl: string | null };
      project?: { id: string; name: string };
      cycle?: { number: number; name: string | null };
      parent?: { identifier: string };
    } = {};

    if (dto.assigneeId) {
      await this.access.assertActiveMember(dto.assigneeId, orgId);
      refs.assignee = await this.actor(dto.assigneeId);
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, orgId, archivedAt: null },
        select: { id: true, name: true },
      });
      if (!project) throw new NotFoundException("Project not found");
      refs.project = project;
    }
    if (dto.cycleId) {
      const cycle = await this.prisma.cycle.findFirst({
        where: { id: dto.cycleId, orgId },
        select: { teamId: true, number: true, name: true, completedAt: true },
      });
      if (!cycle) throw new NotFoundException("Cycle not found");
      if (cycle.teamId !== teamId) throw new BadRequestException("Cycle belongs to a different team");
      if (cycle.completedAt) throw new BadRequestException("Cycle is already completed");
      refs.cycle = cycle;
    }
    if (dto.parentId) {
      if (dto.parentId === selfId) throw new BadRequestException("An issue can't be its own parent");
      const parent = await this.prisma.issue.findFirst({
        where: { id: dto.parentId, orgId, deletedAt: null },
        select: { id: true, number: true, parentId: true, team: { select: { key: true } } },
      });
      if (!parent) throw new NotFoundException("Parent issue not found");
      if (selfId) await this.assertNotDescendant(parent.parentId, selfId);
      refs.parent = { identifier: `${parent.team.key}-${parent.number}` };
    }
    if (dto.labelIds?.length) {
      const ids = [...new Set(dto.labelIds)];
      const found = await this.prisma.issueLabel.count({
        where: { id: { in: ids }, orgId, OR: [{ teamId: null }, { teamId }] },
      });
      if (found !== ids.length) throw new BadRequestException("Unknown label for this team");
    }
    return refs;
  }

  /** Walks up from `ancestorId`; reaching `selfId` would make the hierarchy a loop. */
  private async assertNotDescendant(ancestorId: string | null, selfId: string) {
    let cursor = ancestorId;
    for (let depth = 0; cursor && depth < 50; depth++) {
      if (cursor === selfId) {
        throw new BadRequestException("That would make the issue a sub-issue of itself");
      }
      const next = await this.prisma.issue.findUnique({ where: { id: cursor }, select: { parentId: true } });
      cursor = next?.parentId ?? null;
    }
  }

  private async linkProjectToTeam(tx: Prisma.TransactionClient, projectId: string, teamId: string) {
    await tx.project.update({
      where: { id: projectId },
      data: { teams: { connect: { id: teamId } } },
    });
  }

  private cycleLabel(cycle: { number: number; name: string | null }) {
    return cycle.name ? `${cycle.name} (Cycle ${cycle.number})` : `Cycle ${cycle.number}`;
  }

  private async actor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    return { name: fullName(user) ?? "Someone", avatarUrl: user?.avatarUrl ?? null };
  }

  private async notifyChanges(
    caller: JwtPayload,
    before: { assigneeId: string | null; status: IssueStatus; creatorId: string },
    issue: {
      id: string;
      identifier: string;
      title: string;
      status: IssueStatus;
      assigneeId: string | null;
      creatorId: string;
    },
    dto: UpdateIssueDto,
  ) {
    const assigneeChanged = dto.assigneeId !== undefined && dto.assigneeId !== before.assigneeId;
    const statusChanged = dto.status !== undefined && dto.status !== before.status;
    if (!assigneeChanged && !statusChanged) return;

    const actor = await this.actor(caller.sub);
    if (assigneeChanged && issue.assigneeId && issue.assigneeId !== caller.sub) {
      await this.safeNotify({
        userId: issue.assigneeId,
        orgId: caller.orgId,
        ...NotificationTemplates.issueAssigned(actor.name, issue.id, issue.identifier, issue.title, actor.avatarUrl),
      });
    }
    if (statusChanged) {
      const recipients = new Set(
        [issue.creatorId, assigneeChanged ? null : issue.assigneeId].filter(
          (id): id is string => !!id && id !== caller.sub,
        ),
      );
      await Promise.all(
        [...recipients].map((userId) =>
          this.safeNotify({
            userId,
            orgId: caller.orgId,
            ...NotificationTemplates.issueStatusChanged(
              actor.name,
              issue.id,
              issue.identifier,
              issue.title,
              STATUS_LABEL[issue.status],
              actor.avatarUrl,
            ),
          }),
        ),
      );
    }
  }

  private async notifyMentioned(
    caller: JwtPayload,
    issue: { id: string; title: string },
    identifier: string,
    mentionedUserIds: string[],
    excludeUserIds: string[],
  ) {
    if (!mentionedUserIds.length) return;
    const actor = await this.actor(caller.sub);
    await this.notifications.notifyMentions({
      mentionedUserIds,
      orgId: caller.orgId,
      authorId: caller.sub,
      excludeUserIds,
      payload: NotificationTemplates.mentioned(
        actor.name,
        { surface: "issue", entityId: issue.id, label: `${identifier} ${issue.title}`, actionUrl: `/issues/${issue.id}` },
        actor.avatarUrl,
      ),
    });
  }

  // A failed notification must never fail the write that triggered it.
  private async safeNotify(input: Parameters<NotificationsService["notify"]>[0]) {
    try {
      await this.notifications.notify(input);
    } catch (error) {
      this.logger.warn(`Issue notification failed: ${(error as Error).message}`);
    }
  }
}
