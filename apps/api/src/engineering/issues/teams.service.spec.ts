import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TeamsService } from "./teams.service";
import { IssueAccess } from "./issue-access";
import { JwtPayload } from "@/common/decorators/current-user.decorator";

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: "user-1", email: "a@b.com", orgId: "org-1", role: "MEMBER", ...overrides };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("TeamService", () => {
  let service: TeamsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      team: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      teamMember: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      membership: { findUnique: jest.fn() },
      issueLabel: { count: jest.fn().mockResolvedValue(1), createMany: jest.fn() },
    };
    service = new TeamsService(prisma, new IssueAccess(prisma));
  });

  describe("create", () => {
    it("rejects non-admins", async () => {
      await expect(service.create(payload(), { name: "Platform", key: "PLT" })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it("creates the team in the caller's org and makes the creator its lead", async () => {
      prisma.team.create.mockResolvedValue({ id: "t-1" });
      await service.create(payload({ role: "ADMIN" }), { name: "Platform", key: "PLT" });
      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: "org-1",
            key: "PLT",
            members: { create: { userId: "user-1", role: "LEAD" } },
          }),
        }),
      );
    });

    it("maps a duplicate key to a conflict", async () => {
      prisma.team.create.mockRejectedValue(uniqueViolation());
      await expect(
        service.create(payload({ role: "OWNER" }), { name: "Platform", key: "PLT" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("update", () => {
    it("404s for a team outside the caller's org", async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.update("t-1", payload({ role: "ADMIN" }), {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejects a plain member", async () => {
      prisma.team.findFirst.mockResolvedValue({ id: "t-1" });
      prisma.teamMember.findUnique.mockResolvedValue({ role: "MEMBER" });
      await expect(service.update("t-1", payload(), { name: "New" })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows a team lead", async () => {
      prisma.team.findFirst.mockResolvedValue({ id: "t-1" });
      prisma.teamMember.findUnique.mockResolvedValue({ role: "LEAD" });
      prisma.team.update.mockResolvedValue({ id: "t-1" });
      await service.update("t-1", payload(), { name: "New" });
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { name: "New" },
      });
    });
  });

  describe("archive", () => {
    it("is admin-only", async () => {
      await expect(service.setArchived("t-1", payload(), true)).rejects.toThrow(ForbiddenException);
    });

    it("sets archivedAt instead of deleting", async () => {
      prisma.team.findFirst.mockResolvedValue({ id: "t-1" });
      prisma.team.update.mockResolvedValue({ id: "t-1" });
      await service.setArchived("t-1", payload({ role: "ADMIN" }), true);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { archivedAt: expect.any(Date) },
      });
    });
  });

  describe("addMember", () => {
    beforeEach(() => {
      prisma.team.findFirst.mockResolvedValue({ id: "t-1" });
    });

    it("rejects a user who is not in the org", async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(
        service.addMember("t-1", payload({ role: "ADMIN" }), { userId: "u-9" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("upserts the member, defaulting to the MEMBER role", async () => {
      prisma.membership.findUnique.mockResolvedValue({ status: "ACTIVE" });
      prisma.teamMember.upsert.mockResolvedValue({ id: "m-1" });
      await service.addMember("t-1", payload({ role: "ADMIN" }), { userId: "u-9" });
      expect(prisma.teamMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { teamId: "t-1", userId: "u-9", role: "MEMBER" },
          update: { role: "MEMBER" },
        }),
      );
    });
  });

  describe("removeMember", () => {
    beforeEach(() => {
      prisma.team.findFirst.mockResolvedValue({ id: "t-1" });
    });

    it("lets a member leave without management rights", async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ id: "m-1", role: "MEMBER" });
      await service.removeMember("t-1", "user-1", payload());
      expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    });

    it("rejects a plain member removing someone else", async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: "MEMBER" });
      await expect(service.removeMember("t-1", "u-9", payload())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.teamMember.delete).not.toHaveBeenCalled();
    });

    it("refuses to remove the last lead", async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ id: "m-1", role: "LEAD" });
      prisma.teamMember.count.mockResolvedValue(1);
      await expect(
        service.removeMember("t-1", "u-9", payload({ role: "ADMIN" })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.teamMember.delete).not.toHaveBeenCalled();
    });

    it("removes a lead when another lead remains", async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ id: "m-1", role: "LEAD" });
      prisma.teamMember.count.mockResolvedValue(2);
      await service.removeMember("t-1", "u-9", payload({ role: "ADMIN" }));
      expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    });

    it("404s when the user is not on the team", async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(
        service.removeMember("t-1", "u-9", payload({ role: "ADMIN" })),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
