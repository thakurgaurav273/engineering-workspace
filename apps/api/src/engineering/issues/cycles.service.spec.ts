import { BadRequestException } from "@nestjs/common";
import { CyclesService } from "./cycles.service";
import { IssueAccess } from "./issue-access";
import { progressFrom } from "./workflow";
import { JwtPayload } from "@/common/decorators/current-user.decorator";

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: "user-1", email: "a@b.com", orgId: "org-1", role: "MEMBER", ...overrides };
}

describe("CyclesService", () => {
  let service: CyclesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      team: { findFirst: jest.fn().mockResolvedValue({ id: "t-1", archivedAt: null }), update: jest.fn() },
      cycle: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      issue: { updateMany: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
      issueState: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction = jest.fn((arg: any) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg)));
    service = new CyclesService(prisma, new IssueAccess(prisma));
  });

  it("rejects a cycle that ends before it starts", async () => {
    await expect(
      service.create(payload(), { teamId: "t-1", startsAt: "2026-11-10", endsAt: "2026-11-03" }),
    ).rejects.toThrow("Cycle must end after it starts");
  });

  it("rejects overlapping cycles in the same team", async () => {
    prisma.cycle.findFirst.mockResolvedValue({ number: 4 });
    await expect(
      service.create(payload(), { teamId: "t-1", startsAt: "2026-11-03", endsAt: "2026-11-17" }),
    ).rejects.toThrow("Overlaps with Cycle 4");
  });

  it("numbers cycles per team", async () => {
    prisma.cycle.findFirst.mockResolvedValue(null);
    prisma.team.update.mockResolvedValue({ cycleCounter: 5 });
    prisma.cycle.create.mockResolvedValue({
      id: "c-5",
      startsAt: new Date("2030-01-01"),
      endsAt: new Date("2030-01-14"),
      completedAt: null,
    });
    const cycle = await service.create(payload(), { teamId: "t-1", startsAt: "2030-01-01", endsAt: "2030-01-14" });
    expect(prisma.cycle.create.mock.calls[0][0].data.number).toBe(5);
    expect(cycle.state).toBe("upcoming");
  });

  it("rolls unfinished issues into the chosen cycle when completing", async () => {
    prisma.cycle.findFirst
      .mockResolvedValueOnce({ id: "c-1", teamId: "t-1", completedAt: null }) // the cycle
      .mockResolvedValueOnce({ id: "c-2", teamId: "t-1", completedAt: null }) // rollover target
      .mockResolvedValueOnce({ id: "c-1", startsAt: new Date(), endsAt: new Date(), completedAt: new Date() });

    await service.complete("c-1", payload(), { rolloverToCycleId: "c-2" });

    expect(prisma.issue.updateMany).toHaveBeenCalledWith({
      where: { cycleId: "c-1", deletedAt: null, state: { category: { in: ["BACKLOG", "UNSTARTED", "STARTED"] } } },
      data: { cycleId: "c-2" },
    });
  });

  it("refuses to complete a cycle twice", async () => {
    prisma.cycle.findFirst.mockResolvedValue({ id: "c-1", completedAt: new Date() });
    await expect(service.complete("c-1", payload(), {})).rejects.toThrow(BadRequestException);
  });
});

describe("progressFrom", () => {
  it("excludes canceled issues from the scope", () => {
    expect(progressFrom({ COMPLETED: 2, UNSTARTED: 1, CANCELED: 1, STARTED: 1 })).toEqual({
      total: 5,
      done: 2,
      started: 1,
      canceled: 1,
      percent: 0.5,
    });
  });
});
