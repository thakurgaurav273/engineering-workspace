import { ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { WorkspaceService } from "./workspace.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: "user-1", email: "a@b.com", orgId: "org-1", role: "MEMBER", ...overrides };
}

describe("WorkspaceService", () => {
  let service: WorkspaceService;
  let prisma: any;
  let notifications: any;
  let storage: any;

  beforeEach(() => {
    prisma = {
      workspaceItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      workspaceItemComment: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      membership: { findUnique: jest.fn() },
    };
    notifications = { notify: jest.fn(), notifyMentions: jest.fn() };
    storage = { isConfigured: jest.fn(() => true), buildKey: jest.fn(), presignUpload: jest.fn(), keyFromPublicUrl: jest.fn(() => null) };
    service = new WorkspaceService(prisma, notifications, storage);
  });

  describe("create", () => {
    it("creates an item for self without notifying anyone", async () => {
      prisma.workspaceItem.create.mockResolvedValue({ id: "wi-1", title: "Call client" });

      await service.create(payload(), { title: "Call client" } as any);

      expect(prisma.workspaceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: "user-1", assignedById: null }),
        }),
      );
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it("rejects a MEMBER assigning to someone who is not their direct report", async () => {
      prisma.membership.findUnique.mockResolvedValue({
        status: "ACTIVE",
        manager: { userId: "someone-else" },
      });

      await expect(
        service.create(payload(), { title: "Do X", ownerId: "other-1" } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceItem.create).not.toHaveBeenCalled();
    });

    it("allows a manager to assign to their direct report and notifies them", async () => {
      prisma.membership.findUnique.mockResolvedValue({ manager: { userId: "user-1" } });
      prisma.workspaceItem.create.mockResolvedValue({ id: "wi-1", title: "Review PR" });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Ada",
        lastName: "L",
        avatarUrl: null,
      });

      await service.create(payload(), { title: "Review PR", ownerId: "report-1" } as any);

      expect(prisma.workspaceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: "report-1", assignedById: "user-1" }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "report-1",
          orgId: "org-1",
          type: "WORKSPACE_ITEM_ASSIGNED",
        }),
      );
    });

    it("allows OWNER/ADMIN to assign to anyone in the org", async () => {
      prisma.membership.findUnique.mockResolvedValue({ manager: { userId: "nobody" } });
      prisma.workspaceItem.create.mockResolvedValue({ id: "wi-1", title: "Do X" });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Admin",
        lastName: "A",
        avatarUrl: null,
      });

      await service.create(payload({ sub: "admin-1", role: "ADMIN" }), {
        title: "Do X",
        ownerId: "random-1",
      } as any);

      expect(prisma.workspaceItem.create).toHaveBeenCalled();
      expect(notifications.notify).toHaveBeenCalled();
    });

    it("throws NotFoundException when assigning to a user outside the org", async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(
        service.create(payload(), { title: "Do X", ownerId: "ghost" } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update / access control", () => {
    const item = {
      id: "wi-1",
      orgId: "org-1",
      ownerId: "owner-1",
      assignedById: "assigner-1",
      status: "PENDING",
    };

    it("allows the owner to update their own item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.workspaceItem.update.mockResolvedValue({ ...item, title: "New title" });
      await service.update("wi-1", payload({ sub: "owner-1" }), { title: "New title" });
      expect(prisma.workspaceItem.update).toHaveBeenCalled();
    });

    it("allows whoever assigned it to update it", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.workspaceItem.update.mockResolvedValue(item);
      await service.update("wi-1", payload({ sub: "assigner-1" }), { title: "New title" });
      expect(prisma.workspaceItem.update).toHaveBeenCalled();
    });

    it("allows OWNER/ADMIN to update any item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.workspaceItem.update.mockResolvedValue(item);
      await service.update("wi-1", payload({ sub: "admin-1", role: "OWNER" }), {
        title: "New title",
      });
      expect(prisma.workspaceItem.update).toHaveBeenCalled();
    });

    it("rejects an unrelated member editing someone else's item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      await expect(
        service.update("wi-1", payload({ sub: "random-1" }), { title: "Hijack" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceItem.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a soft-deleted or missing item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(null);
      await expect(
        service.update("wi-1", payload({ sub: "owner-1" }), { title: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("resets reminderStage when the assigner changes the due date", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.workspaceItem.update.mockResolvedValue(item);
      await service.update("wi-1", payload({ sub: "assigner-1" }), { dueDate: "2030-01-01" });
      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reminderStage: "NONE" }) }),
      );
    });

    it("blocks the assignee from changing the due date of an item assigned by someone else", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      await expect(
        service.update("wi-1", payload({ sub: "owner-1" }), { dueDate: "2030-01-01" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceItem.update).not.toHaveBeenCalled();
    });

    it("lets the assignee edit other fields without touching the due date", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({ ...item, dueDate: new Date("2030-01-01") });
      prisma.workspaceItem.update.mockResolvedValue(item);
      // Frontend sends the unchanged due date back; an equal value must not be treated as a change.
      await service.update("wi-1", payload({ sub: "owner-1" }), {
        title: "New title",
        dueDate: "2030-01-01T00:00:00.000Z",
      });
      expect(prisma.workspaceItem.update).toHaveBeenCalled();
    });

    it("lets the owner change the due date on a self-created item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({ ...item, assignedById: null });
      prisma.workspaceItem.update.mockResolvedValue(item);
      await service.update("wi-1", payload({ sub: "owner-1" }), { dueDate: "2030-01-01" });
      expect(prisma.workspaceItem.update).toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("sets completedAt when moving to DONE", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "user-1",
        assignedById: null,
        status: "IN_PROGRESS",
      });
      prisma.workspaceItem.update.mockResolvedValue({});
      await service.updateStatus("wi-1", payload(), { status: "DONE" } as any);
      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "DONE", completedAt: expect.any(Date) }),
        }),
      );
    });

    it("clears completedAt when moving away from DONE", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "user-1",
        assignedById: null,
        status: "DONE",
      });
      prisma.workspaceItem.update.mockResolvedValue({});
      await service.updateStatus("wi-1", payload(), { status: "PENDING" } as any);
      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PENDING", completedAt: null }),
        }),
      );
    });

    it("rejects a non-owner, non-assigner MEMBER from moving the item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "owner-1",
        assignedById: "assigner-1",
        status: "PENDING",
      });
      await expect(
        service.updateStatus("wi-1", payload({ sub: "random-1" }), { status: "DONE" } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it("notifies the assigner and every accumulated watcher when status actually changes", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "jr-1",
        assignedById: "senior-1",
        watcherIds: ["admin-1"],
        status: "PENDING",
      });
      prisma.workspaceItem.update.mockResolvedValue({ id: "wi-1", title: "Delegated task" });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Jr",
        lastName: "Dev",
        avatarUrl: null,
      });

      await service.updateStatus("wi-1", payload({ sub: "jr-1" }), {
        status: "IN_PROGRESS",
      } as any);

      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "senior-1", type: "WORKSPACE_ITEM_STATUS_CHANGED" }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "admin-1", type: "WORKSPACE_ITEM_STATUS_CHANGED" }),
      );
    });

    it("does not notify anyone when the status is unchanged", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "user-1",
        assignedById: "mgr-1",
        watcherIds: [],
        status: "PENDING",
      });
      prisma.workspaceItem.update.mockResolvedValue({ id: "wi-1", title: "x" });

      await service.updateStatus("wi-1", payload(), { status: "PENDING" } as any);

      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    it("rejects archiving a non-DONE item", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "user-1",
        assignedById: null,
        status: "PENDING",
      });
      await expect(service.archive("wi-1", payload())).rejects.toThrow(BadRequestException);
    });

    it("archives a DONE item owned by the caller", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "user-1",
        assignedById: null,
        status: "DONE",
      });
      prisma.workspaceItem.update.mockResolvedValue({});
      await service.archive("wi-1", payload());
      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ archivedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe("remove", () => {
    it("soft-deletes by setting deletedAt", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "user-1",
        assignedById: null,
        status: "PENDING",
      });
      prisma.workspaceItem.update.mockResolvedValue({});
      await service.remove("wi-1", payload());
      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
      );
    });

    it("rejects deleting someone else's item as an unrelated member", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue({
        id: "wi-1",
        orgId: "org-1",
        ownerId: "owner-1",
        assignedById: "assigner-1",
        status: "PENDING",
      });
      await expect(service.remove("wi-1", payload({ sub: "random-1" }))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("getSummary", () => {
    beforeEach(() => {
      prisma.workspaceItem.count.mockResolvedValue(0);
    });

    it("returns self summary without any access check", async () => {
      await expect(service.getSummary(payload())).resolves.toEqual(
        expect.objectContaining({
          pending: 0,
          inProgress: 0,
          done: 0,
          overdue: 0,
          dueToday: 0,
          total: 0,
          completionRate: 0,
        }),
      );
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it("allows OWNER/ADMIN to view anyone's summary without scoping to assignedBy", async () => {
      await service.getSummary(payload({ sub: "admin-1", role: "ADMIN" }), "other-1");
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
      expect(prisma.workspaceItem.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ assignedById: expect.anything() }),
        }),
      );
    });

    it("scopes a manager's view of a report to items they assigned", async () => {
      prisma.membership.findUnique.mockResolvedValue({ manager: { userId: "mgr-1" } });
      await service.getSummary(payload({ sub: "mgr-1" }), "report-1");
      expect(prisma.workspaceItem.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedById: "mgr-1", ownerId: "report-1" }),
        }),
      );
    });

    it("rejects an unrelated member viewing someone else's summary", async () => {
      prisma.membership.findUnique.mockResolvedValue({
        status: "ACTIVE",
        manager: { userId: "someone-else" },
      });
      await expect(service.getSummary(payload({ sub: "random-1" }), "other-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("findAssignedByMe", () => {
    it("scopes to assignedById, not ownerId", async () => {
      prisma.workspaceItem.findMany.mockResolvedValue([]);
      prisma.workspaceItem.count.mockResolvedValue(0);
      await service.findAssignedByMe(payload({ sub: "mgr-1" }), {});
      expect(prisma.workspaceItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedById: "mgr-1", orgId: "org-1" }),
        }),
      );
      expect(prisma.workspaceItem.findMany.mock.calls[0][0].where.ownerId).toBeUndefined();
    });
  });

  describe("listComments", () => {
    const item = { id: "wi-1", orgId: "org-1", ownerId: "owner-1", assignedById: "assigner-1" };

    it("returns comments for someone with access", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.workspaceItemComment.findMany.mockResolvedValue([{ id: "c-1" }]);
      const result = await service.listComments("wi-1", payload({ sub: "owner-1" }));
      expect(result).toEqual([{ id: "c-1" }]);
    });

    it("rejects an unrelated member", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      await expect(service.listComments("wi-1", payload({ sub: "random-1" }))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("addComment", () => {
    const item = {
      id: "wi-1",
      orgId: "org-1",
      ownerId: "owner-1",
      assignedById: "assigner-1",
      title: "Do the thing",
    };

    it("rejects an unrelated member commenting", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      await expect(
        service.addComment("wi-1", payload({ sub: "random-1" }), { body: "hi" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceItemComment.create).not.toHaveBeenCalled();
    });

    it("notifies the owner and assigner (minus the commenter)", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.workspaceItemComment.create.mockResolvedValue({ id: "c-1", body: "hi" });
      prisma.user.findUnique.mockResolvedValue({ firstName: "A", lastName: "B", avatarUrl: null });

      await service.addComment("wi-1", payload({ sub: "owner-1" }), { body: "hi" });

      expect(notifications.notify).toHaveBeenCalledTimes(1);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "assigner-1", type: "WORKSPACE_ITEM_COMMENT" }),
      );
    });

    it("does not notify the commenter themselves", async () => {
      const selfOwned = { ...item, assignedById: null };
      prisma.workspaceItem.findFirst.mockResolvedValue(selfOwned);
      prisma.workspaceItemComment.create.mockResolvedValue({ id: "c-1", body: "hi" });

      await service.addComment("wi-1", payload({ sub: "owner-1" }), { body: "hi" });

      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it("also notifies accumulated watchers from earlier delegations", async () => {
      const delegated = {
        ...item,
        ownerId: "jr-1",
        assignedById: "senior-1",
        watcherIds: ["admin-1"],
      };
      prisma.workspaceItem.findFirst.mockResolvedValue(delegated);
      prisma.workspaceItemComment.create.mockResolvedValue({ id: "c-1", body: "status update" });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Jr",
        lastName: "Dev",
        avatarUrl: null,
      });

      await service.addComment("wi-1", payload({ sub: "jr-1" }), { body: "status update" });

      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "senior-1" }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "admin-1" }),
      );
    });
  });

  describe("delegate", () => {
    const item = {
      id: "wi-1",
      orgId: "org-1",
      ownerId: "senior-1",
      assignedById: "admin-1",
      watcherIds: [] as string[],
      title: "Ship the feature",
    };

    it("rejects a non-owner, non-admin from delegating", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      await expect(
        service.delegate("wi-1", payload({ sub: "random-1" }), { ownerId: "jr-1" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceItem.update).not.toHaveBeenCalled();
    });

    it("rejects delegating to whoever already owns it", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      await expect(
        service.delegate("wi-1", payload({ sub: "senior-1" }), { ownerId: "senior-1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects delegating to someone who is not an active org member", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.membership.findUnique.mockResolvedValue({ status: "SUSPENDED" });
      await expect(
        service.delegate("wi-1", payload({ sub: "senior-1" }), { ownerId: "jr-1" }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.workspaceItem.update).not.toHaveBeenCalled();
    });

    // Unlike creating an item, delegation is not limited to direct reports - the
    // delegator already owns the item (see the comment on WorkspaceService.delegate).
    it("lets a non-admin owner delegate to someone outside their reports", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.membership.findUnique.mockResolvedValue({
        status: "ACTIVE",
        manager: { userId: "someone-else" },
      });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Senior",
        lastName: "Dev",
        avatarUrl: null,
      });
      prisma.workspaceItem.update.mockResolvedValue({ id: "wi-1", title: "Ship the feature" });

      await service.delegate("wi-1", payload({ sub: "senior-1" }), { ownerId: "jr-1" });

      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ownerId: "jr-1" }) }),
      );
    });

    it("folds the outgoing owner and assigner into watcherIds, reassigns, and notifies the new owner", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.membership.findUnique.mockResolvedValue({
        status: "ACTIVE",
        manager: { userId: "senior-1" },
      });
      prisma.workspaceItem.update.mockResolvedValue({ id: "wi-1", title: "Ship the feature" });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Senior",
        lastName: "Dev",
        avatarUrl: null,
      });

      await service.delegate("wi-1", payload({ sub: "senior-1" }), { ownerId: "jr-1" });

      expect(prisma.workspaceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: "jr-1",
            assignedById: "senior-1",
            watcherIds: expect.arrayContaining(["senior-1", "admin-1"]),
          }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "jr-1", type: "WORKSPACE_ITEM_ASSIGNED" }),
      );
    });

    it("allows OWNER/ADMIN to delegate an item they neither own nor assigned", async () => {
      prisma.workspaceItem.findFirst.mockResolvedValue(item);
      prisma.membership.findUnique.mockResolvedValue({
        status: "ACTIVE",
        manager: { userId: "someone-else" },
      });
      prisma.user.findUnique.mockResolvedValue({
        firstName: "Admin",
        lastName: "A",
        avatarUrl: null,
      });
      prisma.workspaceItem.update.mockResolvedValue({ id: "wi-1", title: "Ship the feature" });

      await service.delegate("wi-1", payload({ sub: "admin-2", role: "ADMIN" }), {
        ownerId: "jr-1",
      });

      expect(prisma.workspaceItem.update).toHaveBeenCalled();
    });
  });
});
