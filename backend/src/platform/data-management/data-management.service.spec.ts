import { NotFoundException } from '@nestjs/common';
import { DataManagementService } from './data-management.service';

describe('DataManagementService', () => {
  let service: DataManagementService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      checkIn: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      recognition: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      weeklyReview: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      goal: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      notification: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    service = new DataManagementService(prisma);
  });

  describe('listCheckIns', () => {
    it('applies search, userId and date-range filters', async () => {
      prisma.checkIn.findMany.mockResolvedValue([{ id: 'ci-1' }]);
      prisma.checkIn.count.mockResolvedValue(1);

      await service.listCheckIns('org-1', {
        page: 1,
        limit: 20,
        search: 'blocked on',
        userId: 'user-1',
        from: '2026-01-01',
        to: '2026-01-31',
      });

      const call = prisma.checkIn.findMany.mock.calls[0][0];
      expect(call.where.orgId).toBe('org-1');
      expect(call.where.userId).toBe('user-1');
      expect(call.where.OR).toEqual([
        { summary: { contains: 'blocked on', mode: 'insensitive' } },
        { blockers: { contains: 'blocked on', mode: 'insensitive' } },
      ]);
      expect(call.where.date.gte).toEqual(new Date('2026-01-01'));
      expect(call.where.date.lte).toEqual(new Date('2026-01-31'));
    });

    it('returns a paginate() envelope', async () => {
      prisma.checkIn.findMany.mockResolvedValue([{ id: 'ci-1' }]);
      prisma.checkIn.count.mockResolvedValue(1);

      const result = await service.listCheckIns('org-1', { page: 1, limit: 20 });

      expect(result).toEqual({
        success: true,
        data: [{ id: 'ci-1' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });
  });

  describe('deleteCheckIn', () => {
    it('throws NotFoundException when the check-in does not belong to the org', async () => {
      prisma.checkIn.findFirst.mockResolvedValue(null);
      await expect(service.deleteCheckIn('org-1', 'ci-1')).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deletes the check-in and any notifications referencing it in one transaction', async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'ci-1', orgId: 'org-1' });
      prisma.notification.deleteMany.mockResolvedValue({ count: 2 });
      prisma.checkIn.delete.mockResolvedValue({ id: 'ci-1' });

      await service.deleteCheckIn('org-1', 'ci-1');

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', entityType: 'checkin', entityId: 'ci-1' },
      });
      expect(prisma.checkIn.delete).toHaveBeenCalledWith({ where: { id: 'ci-1' } });
    });
  });

  describe('bulkDeleteCheckIns', () => {
    it('deletes matching check-ins scoped to org and their notifications', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 3 });
      prisma.checkIn.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkDeleteCheckIns('org-1', ['ci-1', 'ci-2']);

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', entityType: 'checkin', entityId: { in: ['ci-1', 'ci-2'] } },
      });
      expect(prisma.checkIn.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', id: { in: ['ci-1', 'ci-2'] } },
      });
      expect(result).toEqual({ message: '2 check-in(s) deleted', count: 2 });
    });
  });

  describe('listRecognitions', () => {
    it('combines a userId (author-or-recipient) filter with a search filter via AND', async () => {
      prisma.recognition.findMany.mockResolvedValue([]);
      prisma.recognition.count.mockResolvedValue(0);

      await service.listRecognitions('org-1', { page: 1, limit: 20, search: 'great job', userId: 'user-1' });

      const call = prisma.recognition.findMany.mock.calls[0][0];
      expect(call.where.AND).toEqual([
        { OR: [{ authorId: 'user-1' }, { recipientId: 'user-1' }] },
        {
          OR: [
            { title: { contains: 'great job', mode: 'insensitive' } },
            { note: { contains: 'great job', mode: 'insensitive' } },
          ],
        },
      ]);
    });
  });

  describe('deleteRecognition', () => {
    it('throws NotFoundException for a cross-org id', async () => {
      prisma.recognition.findFirst.mockResolvedValue(null);
      await expect(service.deleteRecognition('org-1', 'rec-1')).rejects.toThrow(NotFoundException);
    });

    it('cleans up notifications tagged entityType "recognition"', async () => {
      prisma.recognition.findFirst.mockResolvedValue({ id: 'rec-1' });
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      prisma.recognition.delete.mockResolvedValue({ id: 'rec-1' });

      await service.deleteRecognition('org-1', 'rec-1');

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', entityType: 'recognition', entityId: 'rec-1' },
      });
    });
  });

  describe('listReviews', () => {
    it('filters by reviewee-or-reviewer for the userId filter', async () => {
      prisma.weeklyReview.findMany.mockResolvedValue([]);
      prisma.weeklyReview.count.mockResolvedValue(0);

      await service.listReviews('org-1', { page: 1, limit: 20, userId: 'user-1' });

      const call = prisma.weeklyReview.findMany.mock.calls[0][0];
      expect(call.where.AND).toEqual([{ OR: [{ revieweeId: 'user-1' }, { reviewerId: 'user-1' }] }]);
    });
  });

  describe('deleteReview / bulkDeleteReviews', () => {
    it('throws NotFoundException when missing', async () => {
      prisma.weeklyReview.findFirst.mockResolvedValue(null);
      await expect(service.deleteReview('org-1', 'rev-1')).rejects.toThrow(NotFoundException);
    });

    it('bulk delete cleans up notifications tagged entityType "review"', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      prisma.weeklyReview.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkDeleteReviews('org-1', ['rev-1']);

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', entityType: 'review', entityId: { in: ['rev-1'] } },
      });
      expect(result).toEqual({ message: '1 review(s) deleted', count: 1 });
    });
  });

  describe('deleteGoal / bulkDeleteGoals', () => {
    it('throws NotFoundException when the goal is not in this org', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);
      await expect(service.deleteGoal('org-1', 'goal-1')).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deletes the goal and cleans up notifications tagged entityType "goal" (GoalHistory cascades at the DB level)', async () => {
      prisma.goal.findFirst.mockResolvedValue({ id: 'goal-1' });
      prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
      prisma.goal.delete.mockResolvedValue({ id: 'goal-1' });

      await service.deleteGoal('org-1', 'goal-1');

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', entityType: 'goal', entityId: 'goal-1' },
      });
      expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: 'goal-1' } });
    });

    it('bulk-deletes goals scoped to org', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
      prisma.goal.deleteMany.mockResolvedValue({ count: 4 });

      const result = await service.bulkDeleteGoals('org-1', ['g1', 'g2', 'g3', 'g4']);

      expect(prisma.goal.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', id: { in: ['g1', 'g2', 'g3', 'g4'] } },
      });
      expect(result.count).toBe(4);
    });
  });

  describe('transactional integrity', () => {
    // Prisma's array-form $transaction([...]) executes every operation in a single
    // DB transaction: if any one of them fails, the whole batch rolls back atomically.
    // These tests confirm the service (a) always routes the notification-cleanup +
    // entity-delete pair through exactly one $transaction call — never two separate
    // awaited calls that could partially apply — and (b) never swallows a failure from
    // either half, so a failure genuinely aborts the whole operation instead of leaving
    // an orphaned notification or a half-deleted entity.

    it('deleteCheckIn passes both operations to a single $transaction call', async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'ci-1' });
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      prisma.checkIn.delete.mockResolvedValue({ id: 'ci-1' });

      await service.deleteCheckIn('org-1', 'ci-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });

    it('deleteCheckIn propagates (does not swallow) a failure deleting the check-in itself', async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'ci-1' });
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      prisma.checkIn.delete.mockRejectedValue(new Error('DB constraint violation'));

      await expect(service.deleteCheckIn('org-1', 'ci-1')).rejects.toThrow('DB constraint violation');
    });

    it('deleteGoal propagates a failure in the notification cleanup half (nothing is silently dropped)', async () => {
      prisma.goal.findFirst.mockResolvedValue({ id: 'goal-1' });
      prisma.notification.deleteMany.mockRejectedValue(new Error('notification table unavailable'));
      prisma.goal.delete.mockResolvedValue({ id: 'goal-1' });

      await expect(service.deleteGoal('org-1', 'goal-1')).rejects.toThrow('notification table unavailable');
    });

    it('bulkDeleteGoals passes both bulk operations to a single $transaction call', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 2 });
      prisma.goal.deleteMany.mockResolvedValue({ count: 2 });

      await service.bulkDeleteGoals('org-1', ['g1', 'g2']);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });
  });

  describe('multi-tenancy scoping', () => {
    it('every list query is scoped by orgId for all five entities', async () => {
      prisma.checkIn.findMany.mockResolvedValue([]);
      prisma.checkIn.count.mockResolvedValue(0);
      prisma.recognition.findMany.mockResolvedValue([]);
      prisma.recognition.count.mockResolvedValue(0);
      prisma.weeklyReview.findMany.mockResolvedValue([]);
      prisma.weeklyReview.count.mockResolvedValue(0);
      prisma.goal.findMany.mockResolvedValue([]);
      prisma.goal.count.mockResolvedValue(0);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listCheckIns('org-1', { page: 1, limit: 20 });
      await service.listRecognitions('org-1', { page: 1, limit: 20 });
      await service.listReviews('org-1', { page: 1, limit: 20 });
      await service.listGoals('org-1', { page: 1, limit: 20 });
      await service.listNotifications('org-1', { page: 1, limit: 20 });

      expect(prisma.checkIn.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
      expect(prisma.recognition.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
      expect(prisma.weeklyReview.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
      expect(prisma.goal.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
      expect(prisma.notification.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
    });

    it('bulk-delete always scopes the deleteMany by orgId, not just by id — a cross-org id list matches nothing', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
      prisma.goal.deleteMany.mockResolvedValue({ count: 0 });

      await service.bulkDeleteGoals('org-1', ['some-other-orgs-goal-id']);

      expect(prisma.goal.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', id: { in: ['some-other-orgs-goal-id'] } },
      });
    });
  });

  describe('notifications', () => {
    it('deleteNotification throws NotFoundException when missing, and does not touch other tables', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.deleteNotification('org-1', 'n-1')).rejects.toThrow(NotFoundException);
      expect(prisma.notification.delete).not.toHaveBeenCalled();
    });

    it('deleteNotification deletes directly without a transaction (leaf entity)', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n-1' });
      prisma.notification.delete.mockResolvedValue({ id: 'n-1' });

      await service.deleteNotification('org-1', 'n-1');

      expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'n-1' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('bulkDeleteNotifications deletes many scoped to org', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.bulkDeleteNotifications('org-1', ['n-1', 'n-2']);

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', id: { in: ['n-1', 'n-2'] } },
      });
      expect(result).toEqual({ message: '5 notification(s) deleted', count: 5 });
    });
  });
});
