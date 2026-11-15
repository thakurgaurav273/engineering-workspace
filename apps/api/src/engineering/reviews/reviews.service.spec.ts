import { ReviewStatus, ReviewType } from '@prisma/client';
import { ReviewsService } from './reviews.service';

describe('ReviewsService - notification hooks', () => {
  let service: ReviewsService;
  let prisma: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      membership: { findFirst: jest.fn() },
      weeklyReview: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    service = new ReviewsService(prisma, notifications);
  });

  describe('create', () => {
    it('notifies the reviewee when a manager review is created', async () => {
      prisma.membership.findFirst.mockResolvedValue({ userId: 'user-2' });
      prisma.weeklyReview.findUnique.mockResolvedValue(null);
      prisma.weeklyReview.create.mockResolvedValue({
        id: 'rev-1',
        revieweeId: 'user-2',
        reviewer: { firstName: 'Gaurav', lastName: 'K' },
      });

      await service.create('user-1', 'org-1', {
        type: ReviewType.manager,
        weekStart: '2024-01-08',
        revieweeId: 'user-2',
      } as any);

      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', orgId: 'org-1', entityId: 'rev-1' }),
      );
    });

    it('does not notify for a self review', async () => {
      prisma.weeklyReview.findUnique.mockResolvedValue(null);
      prisma.weeklyReview.create.mockResolvedValue({
        id: 'rev-1',
        revieweeId: 'user-1',
        reviewer: { firstName: 'Gaurav', lastName: 'K' },
      });

      await service.create('user-1', 'org-1', { type: ReviewType.self, weekStart: '2024-01-08' } as any);

      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('fields per review type', () => {
    beforeEach(() => {
      prisma.membership.findFirst.mockResolvedValue({ userId: 'user-2' });
      prisma.weeklyReview.findUnique.mockResolvedValue(null);
      prisma.weeklyReview.create.mockResolvedValue({
        id: 'rev-1',
        revieweeId: 'user-2',
        reviewer: { firstName: 'Gaurav', lastName: 'K' },
      });
    });

    it('rejects a rating and feedback on a self review', async () => {
      await expect(
        service.create('user-1', 'org-1', {
          type: ReviewType.self,
          weekStart: '2024-01-08',
          wins: 'Shipped it',
          feedback: 'x',
          rating: 4,
        } as any),
      ).rejects.toThrow("A self review doesn't take feedback or a rating.");
      expect(prisma.weeklyReview.create).not.toHaveBeenCalled();
    });

    it('rejects challenges and learning on a manager review', async () => {
      await expect(
        service.create('user-1', 'org-1', {
          type: ReviewType.manager,
          weekStart: '2024-01-08',
          revieweeId: 'user-2',
          challenges: 'x',
          learning: 'y',
        } as any),
      ).rejects.toThrow("A manager review doesn't take challenges or learning.");
    });

    it('accepts each type in its own shape', async () => {
      await service.create('user-1', 'org-1', {
        type: ReviewType.self,
        weekStart: '2024-01-08',
        wins: 'a',
        challenges: 'b',
        learning: 'c',
      } as any);
      await service.create('user-1', 'org-1', {
        type: ReviewType.manager,
        weekStart: '2024-01-08',
        revieweeId: 'user-2',
        wins: 'a',
        feedback: 'b',
        rating: 4,
      } as any);
      expect(prisma.weeklyReview.create).toHaveBeenCalledTimes(2);
    });

    it('applies the same rule to edits of a draft', async () => {
      prisma.weeklyReview.findFirst.mockResolvedValue({
        id: 'rev-1',
        type: ReviewType.self,
        reviewerId: 'user-1',
        status: ReviewStatus.draft,
      });
      await expect(
        service.update('rev-1', 'user-1', 'org-1', { rating: 5 } as any),
      ).rejects.toThrow("A self review doesn't take a rating.");
      expect(prisma.weeklyReview.update).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('notifies the reviewee when a manager review is submitted', async () => {
      prisma.weeklyReview.findFirst.mockResolvedValue({
        id: 'rev-1',
        reviewerId: 'user-1',
        status: ReviewStatus.draft,
      });
      prisma.weeklyReview.update.mockResolvedValue({
        id: 'rev-1',
        type: ReviewType.manager,
        revieweeId: 'user-2',
        reviewer: { firstName: 'Gaurav', lastName: 'K' },
      });

      await service.submit('rev-1', 'user-1', 'org-1');

      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', orgId: 'org-1', entityId: 'rev-1' }),
      );
    });

    it('does not notify when a self review is submitted', async () => {
      prisma.weeklyReview.findFirst.mockResolvedValue({
        id: 'rev-1',
        reviewerId: 'user-1',
        status: ReviewStatus.draft,
      });
      prisma.weeklyReview.update.mockResolvedValue({
        id: 'rev-1',
        type: ReviewType.self,
        revieweeId: 'user-1',
        reviewer: { firstName: 'Gaurav', lastName: 'K' },
      });

      await service.submit('rev-1', 'user-1', 'org-1');

      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });
});
