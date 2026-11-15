import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GoalStatus } from '@prisma/client';
import { GoalsService } from './goals.service';

const caller = (sub: string, role = 'MEMBER') => ({ sub, orgId: 'org1', role, email: 'x@y.z' }) as any;

describe('GoalsService - who can change a goal, and linked work', () => {
  let prisma: any;
  let goalProgress: any;
  let service: GoalsService;

  const stored = (over: object = {}) => ({
    id: 'g1',
    orgId: 'org1',
    userId: 'owner',
    assignedById: 'manager',
    status: GoalStatus.active,
    progress: 20,
    projects: [],
    issues: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      goal: {
        findFirst: jest.fn(),
        update: jest.fn(async () => ({ id: 'g1', projects: [], issues: [] })),
        findUniqueOrThrow: jest.fn(async () => ({ id: 'g1', projects: [], issues: [] })),
      },
      goalHistory: { create: jest.fn() },
      project: { count: jest.fn() },
      issue: { count: jest.fn() },
      $transaction: jest.fn(async (ops) => Promise.all(ops)),
    };
    goalProgress = { workFor: jest.fn(async () => new Map()), syncGoals: jest.fn() };
    service = new GoalsService(prisma, { notify: jest.fn() } as any, goalProgress);
  });

  it('lets the person who assigned the goal edit it', async () => {
    prisma.goal.findFirst.mockResolvedValue(stored());
    await service.update('g1', caller('manager'), { title: 'Sharper title' });
    expect(prisma.goal.update).toHaveBeenCalled();
  });

  it('lets an admin edit anyone’s goal, but not an unrelated member', async () => {
    prisma.goal.findFirst.mockResolvedValue(stored());
    await service.update('g1', caller('someone-admin', 'ADMIN'), { title: 'Sharper title' });
    await expect(service.update('g1', caller('stranger'), { title: 'Nope!' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('links projects and re-measures the goal from them', async () => {
    prisma.goal.findFirst.mockResolvedValue(stored());
    prisma.project.count.mockResolvedValue(2);
    await service.update('g1', caller('owner'), { projectIds: ['p1', 'p2'] });
    expect(prisma.goal.update.mock.calls[0][0].data.projects).toEqual({
      set: [{ id: 'p1' }, { id: 'p2' }],
    });
    expect(goalProgress.syncGoals).toHaveBeenCalledWith(['g1']);
  });

  it("rejects links to another organization's projects", async () => {
    prisma.goal.findFirst.mockResolvedValue(stored());
    prisma.project.count.mockResolvedValue(1); // only one of the two is ours
    await expect(
      service.update('g1', caller('owner'), { projectIds: ['p1', 'p-elsewhere'] }),
    ).rejects.toThrow("Some of the linked projects don't exist in this organization");
  });

  it('refuses manual progress and completion on a goal measured by linked work', async () => {
    prisma.goal.findFirst.mockResolvedValue(stored({ projects: [{ id: 'p1' }] }));
    await expect(service.updateProgress('g1', caller('owner'), { progress: 90 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.complete('g1', caller('owner'))).rejects.toThrow(
      /follows its linked work/,
    );
  });

  it('reopens a completed manual goal', async () => {
    prisma.goal.findFirst.mockResolvedValue(stored({ status: GoalStatus.completed, progress: 100 }));
    await service.reopen('g1', caller('owner'));
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: GoalStatus.active, completedAt: null } }),
    );
  });
});
