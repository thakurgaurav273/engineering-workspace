jest.mock('@/common/utils/encryption', () => ({ decrypt: (v: string) => v }));

const mockRequest = jest.fn();
jest.mock('@linear/sdk', () => ({
  LinearClient: jest.fn().mockImplementation(() => ({ client: { request: mockRequest } })),
}));

import { LinearSyncService } from './linear-sync.service';

describe('LinearSyncService', () => {
  let service: LinearSyncService;
  let prisma: any;
  let notifications: any;

  beforeEach(() => {
    mockRequest.mockReset();
    prisma = {
      organization: { findUnique: jest.fn(), findMany: jest.fn() },
      user: { findMany: jest.fn() },
      linearIssue: { findMany: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    service = new LinearSyncService(prisma, notifications);
  });

  it('skips orgs with no Linear API key', async () => {
    prisma.organization.findUnique.mockResolvedValue({ linearApiKey: null });
    const result = await service.syncAssignedIssues('org-1');
    expect(result).toEqual({ skipped: true, synced: 0, archived: 0 });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('upserts fetched issues, matches assignees by email, and notifies on first-seen assignment', async () => {
    prisma.organization.findUnique.mockResolvedValue({ linearApiKey: 'enc-key' });
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', email: 'ada@grovyn.in' }]);
    prisma.linearIssue.findMany.mockResolvedValue([]);
    prisma.linearIssue.upsert.mockResolvedValue({ id: 'issue-1' });
    mockRequest.mockResolvedValueOnce({
      issues: {
        nodes: [
          {
            id: 'linear-uuid-1',
            identifier: 'ENG-1',
            title: 'Fix the thing',
            url: 'https://linear.app/x/issue/ENG-1',
            priority: 2,
            estimate: 3,
            dueDate: null,
            assignee: { email: 'ada@grovyn.in' },
            state: { name: 'In Progress', type: 'started' },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });

    const result = await service.syncAssignedIssues('org-1');

    expect(result).toEqual({ skipped: false, synced: 1, archived: 0 });
    expect(prisma.linearIssue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_linearId: { orgId: 'org-1', linearId: 'linear-uuid-1' } },
        create: expect.objectContaining({ assigneeId: 'user-1', orgId: 'org-1', linearId: 'linear-uuid-1' }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', orgId: 'org-1' }),
    );
  });

  it('does not notify again for an issue that is already assigned to the same person', async () => {
    prisma.organization.findUnique.mockResolvedValue({ linearApiKey: 'enc-key' });
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', email: 'ada@grovyn.in' }]);
    prisma.linearIssue.findMany.mockResolvedValue([
      { id: 'issue-1', linearId: 'linear-uuid-1', assigneeId: 'user-1', archivedAt: null },
    ]);
    prisma.linearIssue.upsert.mockResolvedValue({ id: 'issue-1' });
    mockRequest.mockResolvedValueOnce({
      issues: {
        nodes: [
          {
            id: 'linear-uuid-1',
            identifier: 'ENG-1',
            title: 'Fix the thing',
            url: 'https://linear.app/x/issue/ENG-1',
            priority: null,
            estimate: null,
            dueDate: null,
            assignee: { email: 'ada@grovyn.in' },
            state: { name: 'Done', type: 'completed' },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });

    await service.syncAssignedIssues('org-1');

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('archives previously-synced issues that no longer appear in the fetch', async () => {
    prisma.organization.findUnique.mockResolvedValue({ linearApiKey: 'enc-key' });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.linearIssue.findMany.mockResolvedValue([
      { id: 'issue-1', linearId: 'gone-uuid', assigneeId: 'user-1', archivedAt: null },
    ]);
    mockRequest.mockResolvedValueOnce({
      issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    });

    const result = await service.syncAssignedIssues('org-1');

    expect(result.archived).toBe(1);
    expect(prisma.linearIssue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['issue-1'] } }, data: expect.objectContaining({ archivedAt: expect.any(Date) }) }),
    );
  });

  it('returns skipped on a GraphQL failure instead of throwing', async () => {
    prisma.organization.findUnique.mockResolvedValue({ linearApiKey: 'enc-key' });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.linearIssue.findMany.mockResolvedValue([]);
    mockRequest.mockRejectedValue(new Error('Linear API is down'));

    const result = await service.syncAssignedIssues('org-1');
    expect(result).toEqual({ skipped: true, synced: 0, archived: 0 });
  });
});
