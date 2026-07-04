import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskUpdatesService } from './task-updates.service';
import { JwtPayload } from '@/common/decorators/current-user.decorator';

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'user-1', email: 'a@b.com', orgId: 'org-1', role: 'MEMBER', ...overrides };
}

describe('TaskUpdatesService', () => {
  let service: TaskUpdatesService;
  let prisma: any;
  let notifications: any;
  let linearSync: any;
  let linearIntegration: any;

  beforeEach(() => {
    prisma = {
      linearIssue: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
      taskUpdate: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      membership: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    linearSync = { syncAssignedIssues: jest.fn() };
    linearIntegration = { getStatus: jest.fn() };
    service = new TaskUpdatesService(prisma, notifications, linearSync, linearIntegration);
  });

  describe('postUpdate', () => {
    it('rejects when the caller is not the issue assignee', async () => {
      prisma.linearIssue.findFirst.mockResolvedValue({ id: 'issue-1', identifier: 'ENG-1', assigneeId: 'someone-else' });
      await expect(
        service.postUpdate('issue-1', 'org-1', 'user-1', { body: 'progress', status: 'on_track' as any }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.taskUpdate.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an issue outside the org', async () => {
      prisma.linearIssue.findFirst.mockResolvedValue(null);
      await expect(
        service.postUpdate('issue-1', 'org-1', 'user-1', { body: 'progress', status: 'on_track' as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the update and notifies the manager when the assignee posts', async () => {
      prisma.linearIssue.findFirst.mockResolvedValue({ id: 'issue-1', identifier: 'ENG-1', assigneeId: 'user-1' });
      prisma.taskUpdate.create.mockResolvedValue({ id: 'tu-1' });
      prisma.membership.findUnique.mockResolvedValue({
        user: { firstName: 'Ada', lastName: 'L', avatarUrl: null },
        manager: { userId: 'mgr-1' },
      });

      await service.postUpdate('issue-1', 'org-1', 'user-1', { body: 'progress', status: 'on_track' as any });

      expect(prisma.taskUpdate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orgId: 'org-1', issueId: 'issue-1', authorId: 'user-1' }) }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'mgr-1', orgId: 'org-1' }));
    });

    it('does not notify when the author has no manager', async () => {
      prisma.linearIssue.findFirst.mockResolvedValue({ id: 'issue-1', identifier: 'ENG-1', assigneeId: 'user-1' });
      prisma.taskUpdate.create.mockResolvedValue({ id: 'tu-1' });
      prisma.membership.findUnique.mockResolvedValue({
        user: { firstName: 'Ada', lastName: 'L', avatarUrl: null },
        manager: null,
      });

      await service.postUpdate('issue-1', 'org-1', 'user-1', { body: 'progress', status: 'on_track' as any });

      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('editUpdate', () => {
    it('rejects editing someone else\'s update', async () => {
      prisma.taskUpdate.findFirst.mockResolvedValue({ id: 'tu-1', authorId: 'someone-else' });
      await expect(service.editUpdate('tu-1', 'org-1', 'user-1', { body: 'x' })).rejects.toThrow(ForbiddenException);
    });

    it('allows the author to edit their own update', async () => {
      prisma.taskUpdate.findFirst.mockResolvedValue({ id: 'tu-1', authorId: 'user-1' });
      prisma.taskUpdate.update.mockResolvedValue({ id: 'tu-1', body: 'x' });
      await service.editUpdate('tu-1', 'org-1', 'user-1', { body: 'x' });
      expect(prisma.taskUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ body: 'x', isEdited: true }) }),
      );
    });
  });

  describe('deleteUpdate', () => {
    const existing = { id: 'tu-1', authorId: 'author-1' };

    it('allows the author to delete their own update', async () => {
      prisma.taskUpdate.findFirst.mockResolvedValue(existing);
      await service.deleteUpdate('tu-1', 'org-1', payload({ sub: 'author-1' }));
      expect(prisma.taskUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDeleted: true }) }),
      );
    });

    it("allows the author's manager to delete it", async () => {
      prisma.taskUpdate.findFirst.mockResolvedValue(existing);
      prisma.membership.findUnique.mockResolvedValue({ manager: { userId: 'mgr-1' } });
      await service.deleteUpdate('tu-1', 'org-1', payload({ sub: 'mgr-1' }));
      expect(prisma.taskUpdate.update).toHaveBeenCalled();
    });

    it('allows OWNER/ADMIN to delete any update', async () => {
      prisma.taskUpdate.findFirst.mockResolvedValue(existing);
      await service.deleteUpdate('tu-1', 'org-1', payload({ sub: 'admin-1', role: 'ADMIN' }));
      expect(prisma.taskUpdate.update).toHaveBeenCalled();
    });

    it('rejects an unrelated member', async () => {
      prisma.taskUpdate.findFirst.mockResolvedValue(existing);
      prisma.membership.findUnique.mockResolvedValue({ manager: { userId: 'mgr-1' } });
      await expect(service.deleteUpdate('tu-1', 'org-1', payload({ sub: 'random-1' }))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserActivity - assertCanView', () => {
    it('allows a user to view their own activity', async () => {
      prisma.membership.findFirst.mockResolvedValue({ userId: 'user-1', manager: { userId: 'mgr-1' } });
      prisma.linearIssue.findMany.mockResolvedValue([]);
      prisma.taskUpdate.findMany.mockResolvedValue([]);
      prisma.taskUpdate.count.mockResolvedValue(0);
      await expect(service.getUserActivity('user-1', 'org-1', payload({ sub: 'user-1' }), {})).resolves.toBeDefined();
    });

    it("allows the target's direct manager to view it", async () => {
      prisma.membership.findFirst.mockResolvedValue({ userId: 'report-1', manager: { userId: 'mgr-1' } });
      prisma.linearIssue.findMany.mockResolvedValue([]);
      prisma.taskUpdate.findMany.mockResolvedValue([]);
      prisma.taskUpdate.count.mockResolvedValue(0);
      await expect(service.getUserActivity('report-1', 'org-1', payload({ sub: 'mgr-1' }), {})).resolves.toBeDefined();
    });

    it('allows OWNER/ADMIN regardless of hierarchy', async () => {
      prisma.membership.findFirst.mockResolvedValue({ userId: 'report-1', manager: { userId: 'someone-else' } });
      prisma.linearIssue.findMany.mockResolvedValue([]);
      prisma.taskUpdate.findMany.mockResolvedValue([]);
      prisma.taskUpdate.count.mockResolvedValue(0);
      await expect(
        service.getUserActivity('report-1', 'org-1', payload({ sub: 'admin-1', role: 'OWNER' }), {}),
      ).resolves.toBeDefined();
    });

    it('rejects an unrelated MEMBER', async () => {
      prisma.membership.findFirst.mockResolvedValue({ userId: 'report-1', manager: { userId: 'someone-else' } });
      await expect(
        service.getUserActivity('report-1', 'org-1', payload({ sub: 'random-1' }), {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getTeamFeed', () => {
    it('returns an empty page for a member with no direct reports', async () => {
      prisma.membership.findUnique.mockResolvedValue({ id: 'mgr-membership-1' });
      prisma.membership.findMany.mockResolvedValue([]);
      const result = await service.getTeamFeed(payload({ sub: 'user-1', role: 'MEMBER' }), 'org-1', {});
      expect(result.data).toEqual([]);
      expect(prisma.taskUpdate.findMany).not.toHaveBeenCalled();
    });

    it("scopes a manager's feed to their direct reports", async () => {
      prisma.membership.findUnique.mockResolvedValue({ id: 'mgr-membership-1' });
      prisma.membership.findMany.mockResolvedValue([{ userId: 'report-1' }, { userId: 'report-2' }]);
      prisma.taskUpdate.findMany.mockResolvedValue([]);
      prisma.taskUpdate.count.mockResolvedValue(0);
      await service.getTeamFeed(payload({ sub: 'mgr-1', role: 'MEMBER' }), 'org-1', {});
      expect(prisma.taskUpdate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ authorId: { in: ['report-1', 'report-2'] } }) }),
      );
    });

    it('scopes an OWNER/ADMIN feed to the whole org', async () => {
      prisma.taskUpdate.findMany.mockResolvedValue([]);
      prisma.taskUpdate.count.mockResolvedValue(0);
      await service.getTeamFeed(payload({ sub: 'admin-1', role: 'ADMIN' }), 'org-1', {});
      expect(prisma.membership.findMany).not.toHaveBeenCalled();
      expect(prisma.taskUpdate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1', isDeleted: false } }),
      );
    });
  });
});
