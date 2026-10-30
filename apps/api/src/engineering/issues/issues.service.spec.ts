import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { IssuesService } from "./issues.service";
import { IssueAccess } from "./issue-access";
import { JwtPayload } from "@/common/decorators/current-user.decorator";

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: "user-1", email: "a@b.com", orgId: "org-1", role: "MEMBER", ...overrides };
}

const person = (id: string) => ({ id, firstName: "F", lastName: id, avatarUrl: null });

/** A row shaped like `issueSelect`. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "i-1",
    orgId: "org-1",
    teamId: "t-1",
    number: 7,
    title: "Fix sync",
    status: "TODO",
    priority: "NONE",
    estimate: null,
    dueDate: null,
    sortOrder: 0,
    creatorId: "user-1",
    assigneeId: null,
    projectId: null,
    cycleId: null,
    parentId: null,
    startedAt: null,
    completedAt: null,
    canceledAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    team: { id: "t-1", key: "ENG", name: "Engineering" },
    assignee: null,
    creator: person("user-1"),
    project: null,
    cycle: null,
    parent: null,
    labels: [],
    _count: { children: 0 },
    ...overrides,
  };
}

/** What `resolve()` loads (raw issue + labels + team key). */
function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: "i-1",
    orgId: "org-1",
    teamId: "t-1",
    number: 7,
    title: "Fix sync",
    description: null,
    status: "TODO",
    priority: "NONE",
    estimate: null,
    dueDate: null,
    creatorId: "user-1",
    assigneeId: null,
    projectId: null,
    cycleId: null,
    parentId: null,
    startedAt: null,
    labels: [],
    team: { key: "ENG" },
    ...overrides,
  };
}

describe("IssuesService", () => {
  let service: IssuesService;
  let prisma: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      team: { findFirst: jest.fn(), update: jest.fn() },
      teamMember: { findUnique: jest.fn() },
      membership: { findUnique: jest.fn().mockResolvedValue({ status: "ACTIVE" }) },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: "Aditi", lastName: "Rao", avatarUrl: null }) },
      issue: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _min: { sortOrder: 5 } }),
      },
      issueActivity: { create: jest.fn(), createMany: jest.fn() },
      issueComment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      issueLabel: { count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      cycle: { findFirst: jest.fn() },
      project: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    // Interactive transactions run against the same mock; array transactions resolve in order.
    prisma.$transaction = jest.fn((arg: any) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg)));
    notifications = { notify: jest.fn(), notifyMentions: jest.fn() };
    service = new IssuesService(prisma, new IssueAccess(prisma), notifications);
    prisma.team.findFirst.mockResolvedValue({ id: "t-1", orgId: "org-1", archivedAt: null });
  });

  describe("create", () => {
    it("takes the next team number, logs creation and returns an identifier", async () => {
      prisma.team.update.mockResolvedValue({ issueCounter: 8 });
      prisma.issue.create.mockResolvedValue(row({ number: 8 }));

      const issue = await service.create(payload(), { teamId: "t-1", title: "  Fix sync  " });

      expect(prisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { issueCounter: { increment: 1 } } }),
      );
      expect(prisma.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: 8,
            title: "Fix sync",
            status: "TODO",
            priority: "NONE",
            creatorId: "user-1",
            // New issues go to the top of their column.
            sortOrder: 4,
          }),
        }),
      );
      expect(prisma.issueActivity.create).toHaveBeenCalledWith({
        data: { issueId: "i-1", actorId: "user-1", field: "created" },
      });
      expect(issue.identifier).toBe("ENG-8");
    });

    it("rejects an archived team", async () => {
      prisma.team.findFirst.mockResolvedValue({ id: "t-1", archivedAt: new Date() });
      await expect(service.create(payload(), { teamId: "t-1", title: "x" })).rejects.toThrow(ForbiddenException);
    });

    it("rejects a cycle that belongs to another team", async () => {
      prisma.cycle.findFirst.mockResolvedValue({ teamId: "t-2", number: 1, name: null, completedAt: null });
      await expect(
        service.create(payload(), { teamId: "t-1", title: "x", cycleId: "c-1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a label scoped to another team", async () => {
      prisma.issueLabel.count.mockResolvedValue(0);
      await expect(
        service.create(payload(), { teamId: "t-1", title: "x", labelIds: ["l-1"] }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an assignee who is not an active org member", async () => {
      prisma.membership.findUnique.mockResolvedValue({ status: "SUSPENDED" });
      await expect(
        service.create(payload(), { teamId: "t-1", title: "x", assigneeId: "u-9" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("notifies the assignee but not a self-assigning creator", async () => {
      prisma.team.update.mockResolvedValue({ issueCounter: 1 });
      prisma.issue.create.mockResolvedValue(row({ assigneeId: "u-2" }));
      await service.create(payload(), { teamId: "t-1", title: "x", assigneeId: "u-2" });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u-2", type: "ISSUE_ASSIGNED" }),
      );

      notifications.notify.mockClear();
      prisma.issue.create.mockResolvedValue(row({ assigneeId: "user-1" }));
      await service.create(payload(), { teamId: "t-1", title: "x", assigneeId: "user-1" });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("resolves human identifiers like ENG-7", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing());
      prisma.issue.update.mockResolvedValue(row());
      await service.update("eng-7", payload(), { title: "Fix sync" });
      expect(prisma.issue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-1", deletedAt: null, team: { key: "ENG" }, number: 7 },
        }),
      );
    });

    it("stamps lifecycle timestamps and records the status change", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing());
      prisma.issue.update.mockResolvedValue(row({ status: "DONE" }));

      await service.update("i-1", payload(), { status: "DONE" });

      const data = prisma.issue.update.mock.calls[0][0].data;
      expect(data.status).toBe("DONE");
      expect(data.completedAt).toBeInstanceOf(Date);
      expect(data.startedAt).toBeInstanceOf(Date);
      expect(data.canceledAt).toBeNull();
      expect(prisma.issueActivity.createMany).toHaveBeenCalledWith({
        data: [{ issueId: "i-1", actorId: "user-1", field: "status", fromValue: "Todo", toValue: "Done" }],
      });
    });

    it("notifies the creator (not the actor) about status changes", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing({ creatorId: "u-5", assigneeId: "user-1" }));
      prisma.issue.update.mockResolvedValue(row({ status: "IN_REVIEW", creatorId: "u-5", assigneeId: "user-1" }));
      await service.update("i-1", payload(), { status: "IN_REVIEW" });
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u-5", type: "ISSUE_STATUS_CHANGED" }),
      );
    });

    it("writes no activity when nothing changed", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing());
      prisma.issue.update.mockResolvedValue(row());
      await service.update("i-1", payload(), { title: "Fix sync", status: "TODO" });
      expect(prisma.issueActivity.createMany).not.toHaveBeenCalled();
    });

    it("refuses to make an issue its own parent", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing());
      await expect(service.update("i-1", payload(), { parentId: "i-1" })).rejects.toThrow(BadRequestException);
    });

    it("refuses a parent that is already one of its descendants", async () => {
      // i-1 <- i-2 <- i-3: making i-3 the parent of i-1 would close a loop.
      prisma.issue.findFirst
        .mockResolvedValueOnce(existing())
        .mockResolvedValueOnce({ id: "i-3", number: 3, parentId: "i-2", team: { key: "ENG" } });
      prisma.issue.findUnique.mockResolvedValueOnce({ parentId: "i-1" });
      await expect(service.update("i-1", payload(), { parentId: "i-3" })).rejects.toThrow(
        "That would make the issue a sub-issue of itself",
      );
    });

    it("renumbers into the new team and drops the old team's cycle on a team move", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing({ cycleId: "c-1" }));
      prisma.team.update.mockResolvedValue({ issueCounter: 3, key: "PLT" });
      prisma.issue.update.mockResolvedValue(row({ teamId: "t-2", number: 3, team: { id: "t-2", key: "PLT", name: "P" } }));

      const issue = await service.update("i-1", payload(), { teamId: "t-2" });

      const data = prisma.issue.update.mock.calls[0][0].data;
      expect(data).toEqual(expect.objectContaining({ teamId: "t-2", number: 3, cycleId: null }));
      expect(issue.identifier).toBe("PLT-3");
      expect(prisma.issueActivity.createMany.mock.calls[0][0].data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "team", fromValue: "ENG-7", toValue: "PLT-3" })]),
      );
    });

    it("404s for an issue in another org", async () => {
      prisma.issue.findFirst.mockResolvedValue(null);
      await expect(service.update("i-1", payload(), { title: "x" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("lets the creator delete and detaches sub-issues", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing());
      await service.remove("i-1", payload());
      expect(prisma.issue.updateMany).toHaveBeenCalledWith({ where: { parentId: "i-1" }, data: { parentId: null } });
      expect(prisma.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
      );
    });

    it("rejects a plain member who did not create it", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing({ creatorId: "u-5" }));
      prisma.teamMember.findUnique.mockResolvedValue({ role: "MEMBER" });
      await expect(service.remove("i-1", payload())).rejects.toThrow(ForbiddenException);
      expect(prisma.issue.update).not.toHaveBeenCalled();
    });
  });

  describe("addComment", () => {
    it("notifies creator, assignee and earlier commenters, never the author", async () => {
      prisma.issue.findFirst.mockResolvedValue(existing({ creatorId: "u-5", assigneeId: "u-6" }));
      prisma.issueComment.create.mockResolvedValue({ id: "c-1" });
      prisma.issueComment.findMany.mockResolvedValue([{ authorId: "u-7" }, { authorId: "user-1" }]);

      await service.addComment("i-1", payload(), { body: "Looks good" });

      const recipients = notifications.notify.mock.calls.map((c: any[]) => c[0].userId).sort();
      expect(recipients).toEqual(["u-5", "u-6", "u-7"]);
    });
  });

  describe("list", () => {
    it("sorts by priority with No priority last", async () => {
      prisma.issue.findMany.mockResolvedValue([
        row({ id: "a", priority: "NONE" }),
        row({ id: "b", priority: "LOW" }),
        row({ id: "c", priority: "URGENT" }),
      ]);
      const result = await service.list(payload(), { orderBy: "priority" });
      expect(result.data.map((i) => i.id)).toEqual(["c", "b", "a"]);
    });

    it("matches identifiers in search", async () => {
      await service.list(payload(), { search: "ENG-12" });
      const where = prisma.issue.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { OR: [{ title: { contains: "ENG-12", mode: "insensitive" } }, { team: { key: "ENG" }, number: 12 }] },
      ]);
    });

    it('requires a team for cycleId "current"', async () => {
      await expect(service.list(payload(), { cycleId: "current" })).rejects.toThrow(BadRequestException);
    });
  });
});
