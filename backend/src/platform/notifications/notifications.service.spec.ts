import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let push: any;
  let gateway: any;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      pushDevice: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      notificationPreference: {
        upsert: jest.fn(),
      },
    };
    push = { sendToUser: jest.fn() };
    gateway = { emitToUser: jest.fn() };

    service = new NotificationsService(prisma, push, gateway);
  });

  describe('notify', () => {
    const input = {
      userId: 'user-1',
      orgId: 'org-1',
      type: NotificationType.RECOGNITION_RECEIVED,
      title: 'You were recognized',
      body: 'Nice work',
      entityType: 'recognition',
      entityId: 'rec-1',
      actionUrl: '/recognition',
    };

    it('persists the notification and fans out to push + gateway', async () => {
      const created = { id: 'n-1', ...input, isRead: false, createdAt: new Date(), readAt: null };
      prisma.notification.create.mockResolvedValue(created);
      prisma.notificationPreference.upsert.mockResolvedValue({ userId: 'user-1', recognition: true });

      await service.notify(input);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', orgId: 'org-1' }) }),
      );
      expect(push.sendToUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: input.title }));
      expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', 'notification:new', created);
    });

    it('never throws when the push channel rejects - the caller must always succeed', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n-1', ...input });
      prisma.notificationPreference.upsert.mockResolvedValue({ userId: 'user-1', recognition: true });
      push.sendToUser.mockRejectedValue(new Error('FCM is down'));

      await expect(service.notify(input)).resolves.toBeUndefined();
    });

    it('skips push but still persists + emits when the category is opted out', async () => {
      const created = { id: 'n-1', ...input };
      prisma.notification.create.mockResolvedValue(created);
      prisma.notificationPreference.upsert.mockResolvedValue({ userId: 'user-1', recognition: false });

      await service.notify(input);

      expect(push.sendToUser).not.toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', 'notification:new', created);
    });
  });

  describe('registerDevice', () => {
    it('upserts by token for idempotent registration', async () => {
      prisma.pushDevice.upsert.mockResolvedValue({ id: 'd-1', token: 'tok-1' });

      await service.registerDevice('user-1', 'org-1', {
        token: 'tok-1',
        platform: 'WEB' as any,
        browser: 'Chrome',
      });

      expect(prisma.pushDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: 'tok-1' } }),
      );
    });
  });

  describe('unregisterDevice', () => {
    it('throws NotFoundException when the device does not belong to the caller', async () => {
      prisma.pushDevice.findFirst.mockResolvedValue(null);
      await expect(service.unregisterDevice('user-1', 'tok-1')).rejects.toThrow(NotFoundException);
      expect(prisma.pushDevice.delete).not.toHaveBeenCalled();
    });

    it('deletes the device when owned by the caller', async () => {
      prisma.pushDevice.findFirst.mockResolvedValue({ id: 'd-1', token: 'tok-1', userId: 'user-1' });
      await service.unregisterDevice('user-1', 'tok-1');
      expect(prisma.pushDevice.delete).toHaveBeenCalledWith({ where: { token: 'tok-1' } });
    });
  });

  describe('markRead / remove', () => {
    it('throws NotFoundException for a cross-user notification id', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markRead('n-1', 'user-1', 'org-1')).rejects.toThrow(NotFoundException);
      await expect(service.remove('n-1', 'user-1', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });
});
