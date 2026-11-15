import { GoalStatus } from '@prisma/client';
import { GoalProgressService, workFrom } from './goal-progress.service';

describe('workFrom', () => {
  it('measures done against everything but canceled', () => {
    expect(workFrom(['COMPLETED', 'COMPLETED', 'STARTED', 'CANCELED', 'BACKLOG'])).toEqual({
      total: 5,
      done: 2,
      canceled: 1,
      scope: 4,
      percent: 50,
    });
  });

  it('is 0% with nothing in scope', () => {
    expect(workFrom([]).percent).toBe(0);
    expect(workFrom(['CANCELED']).percent).toBe(0);
  });
});

describe('GoalProgressService', () => {
  let prisma: any;
  let service: GoalProgressService;

  const goal = (over: object = {}) => ({
    id: 'g1',
    status: GoalStatus.active,
    progress: 0,
    completedAt: null,
    projects: [{ id: 'p1' }],
    issues: [{ id: 'i9' }],
    ...over,
  });
  const issue = (id: string, category: string, projectId: string | null = 'p1') => ({
    id,
    projectId,
    state: { category },
  });

  beforeEach(() => {
    prisma = {
      goal: { findMany: jest.fn(), update: jest.fn((x) => x) },
      goalHistory: { create: jest.fn((x) => x) },
      issue: { findMany: jest.fn() },
      $transaction: jest.fn(async (ops) => ops),
    };
    service = new GoalProgressService(prisma);
  });

  it('counts an issue once when it is both in a linked project and linked directly', async () => {
    prisma.issue.findMany.mockResolvedValue([
      issue('i1', 'COMPLETED'),
      issue('i9', 'STARTED', 'p1'), // in p1 and linked directly
    ]);
    const work = await service.workFor([goal()]);
    expect(work.get('g1')).toMatchObject({ total: 2, done: 1, percent: 50 });
  });

  it('stores progress from linked work and logs it', async () => {
    prisma.goal.findMany.mockResolvedValue([goal()]);
    prisma.issue.findMany.mockResolvedValue([
      issue('i1', 'COMPLETED'),
      issue('i2', 'STARTED'),
      issue('i3', 'UNSTARTED'),
      issue('i9', 'CANCELED', null),
    ]);
    await service.syncOrg('org1');
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { progress: 33, status: GoalStatus.active, completedAt: null },
    });
    expect(prisma.goalHistory.create).toHaveBeenCalledWith({
      data: { goalId: 'g1', progress: 33, note: 'From linked work: 1 of 3 issues done' },
    });
  });

  it('completes the goal when all linked work is done, and reopens it when work reopens', async () => {
    prisma.goal.findMany.mockResolvedValue([goal({ progress: 50 })]);
    prisma.issue.findMany.mockResolvedValue([issue('i1', 'COMPLETED'), issue('i9', 'COMPLETED', null)]);
    await service.syncOrg('org1');
    expect(prisma.goal.update).toHaveBeenLastCalledWith({
      where: { id: 'g1' },
      data: expect.objectContaining({ progress: 100, status: GoalStatus.completed, completedAt: expect.any(Date) }),
    });
    expect(prisma.goalHistory.create.mock.calls.at(-1)[0].data.note).toBe(
      'Completed - all 2 linked issues are done',
    );

    prisma.goal.findMany.mockResolvedValue([
      goal({ progress: 100, status: GoalStatus.completed, completedAt: new Date() }),
    ]);
    prisma.issue.findMany.mockResolvedValue([issue('i1', 'STARTED'), issue('i9', 'COMPLETED', null)]);
    await service.syncOrg('org1');
    expect(prisma.goal.update).toHaveBeenLastCalledWith({
      where: { id: 'g1' },
      data: { progress: 50, status: GoalStatus.active, completedAt: null },
    });
    expect(prisma.goalHistory.create.mock.calls.at(-1)[0].data.note).toBe(
      'Reopened - 1 of 2 linked issues is open again',
    );
  });

  it('writes nothing when the stored values already match', async () => {
    prisma.goal.findMany.mockResolvedValue([goal({ progress: 50 })]);
    prisma.issue.findMany.mockResolvedValue([issue('i1', 'COMPLETED'), issue('i9', 'STARTED', null)]);
    await service.syncOrg('org1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('never throws into the tracker write that triggered it', async () => {
    prisma.goal.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.syncOrg('org1')).resolves.toBeUndefined();
  });
});
