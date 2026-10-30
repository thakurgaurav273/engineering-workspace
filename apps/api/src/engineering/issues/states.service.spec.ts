import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { StatesService } from "./states.service";
import { IssueAccess } from "./issue-access";
import { JwtPayload } from "@/common/decorators/current-user.decorator";

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: "user-1", email: "a@b.com", orgId: "org-1", role: "MEMBER", ...overrides };
}

describe("StatesService", () => {
  let service: StatesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      team: { findFirst: jest.fn().mockResolvedValue({ id: "t-1", archivedAt: null }) },
      teamMember: { findUnique: jest.fn() },
      issueState: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 1 } }),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      issue: { count: jest.fn(), updateMany: jest.fn() },
    };
    prisma.$transaction = jest.fn((ops: any[]) => Promise.all(ops));
    service = new StatesService(prisma, new IssueAccess(prisma));
  });

  it("lets any member create a status, placed last in its category", async () => {
    prisma.issueState.create.mockResolvedValue({ id: "s-qa" });
    await service.create(payload(), { teamId: "t-1", name: " In QA ", category: "STARTED" });
    expect(prisma.issueState.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "In QA", category: "STARTED", position: 2, color: "#f59e0b" }),
      }),
    );
  });

  it("maps a duplicate name to a conflict", async () => {
    prisma.issueState.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
    );
    await expect(service.create(payload(), { teamId: "t-1", name: "Todo", category: "UNSTARTED" })).rejects.toThrow(
      ConflictException,
    );
  });

  it("requires team management rights to rename", async () => {
    prisma.issueState.findFirst.mockResolvedValue({ id: "s-1", teamId: "t-1", category: "STARTED", name: "Doing" });
    prisma.teamMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    await expect(service.update("s-1", payload(), { name: "Doing it" })).rejects.toThrow(ForbiddenException);
  });

  it("refuses to delete a team's last completed status", async () => {
    prisma.issueState.findFirst.mockResolvedValue({ id: "s-done", teamId: "t-1", category: "COMPLETED", name: "Done" });
    prisma.issueState.count.mockResolvedValue(0);
    await expect(service.remove("s-done", payload({ role: "ADMIN" }), {})).rejects.toThrow(
      "A team needs at least one completed status",
    );
  });

  it("requires a replacement when issues use the status, then moves them", async () => {
    prisma.issueState.findFirst
      .mockResolvedValueOnce({ id: "s-qa", teamId: "t-1", category: "STARTED", name: "In QA" })
      .mockResolvedValueOnce({ id: "s-qa", teamId: "t-1", category: "STARTED", name: "In QA" })
      .mockResolvedValueOnce({ id: "s-review", teamId: "t-1" });
    prisma.issue.count.mockResolvedValue(3);

    await expect(service.remove("s-qa", payload({ role: "ADMIN" }), {})).rejects.toThrow(BadRequestException);

    await service.remove("s-qa", payload({ role: "ADMIN" }), { replacementStateId: "s-review" });
    expect(prisma.issue.updateMany).toHaveBeenCalledWith({ where: { stateId: "s-qa" }, data: { stateId: "s-review" } });
    expect(prisma.issueState.delete).toHaveBeenCalledWith({ where: { id: "s-qa" } });
  });
});
