import { CheckInsService } from './check-ins.service';

describe('CheckInsService - notification hook', () => {
  let service: CheckInsService;
  let prisma: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      checkIn: { findUnique: jest.fn(), create: jest.fn() },
      membership: { findUnique: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    service = new CheckInsService(prisma, notifications);
  });

  it('notifies the manager when the author has one', async () => {
    prisma.checkIn.findUnique.mockResolvedValue(null);
    prisma.checkIn.create.mockResolvedValue({ id: 'ci-1' });
    prisma.membership.findUnique.mockResolvedValue({
      user: { firstName: 'Gaurav', lastName: 'K', avatarUrl: null },
      manager: { userId: 'mgr-1' },
    });

    await service.create('user-1', 'org-1', { status: 'on_track' as any, summary: 'done' });

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'mgr-1', orgId: 'org-1', entityId: 'ci-1' }),
    );
  });

  it('does not notify when the author has no manager', async () => {
    prisma.checkIn.findUnique.mockResolvedValue(null);
    prisma.checkIn.create.mockResolvedValue({ id: 'ci-1' });
    prisma.membership.findUnique.mockResolvedValue({
      user: { firstName: 'Gaurav', lastName: 'K', avatarUrl: null },
      manager: null,
    });

    await service.create('user-1', 'org-1', { status: 'on_track' as any, summary: 'done' });

    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
