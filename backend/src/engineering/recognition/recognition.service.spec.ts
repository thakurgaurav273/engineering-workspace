import { RecognitionService } from './recognition.service';

describe('RecognitionService - notification hook', () => {
  let service: RecognitionService;
  let prisma: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn() },
      recognition: { create: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    service = new RecognitionService(prisma, notifications);
  });

  it('notifies the recipient after a recognition is created', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2', isActive: true });
    prisma.recognition.create.mockResolvedValue({
      id: 'rec-1',
      title: 'Great work',
      recipientId: 'user-2',
      author: { firstName: 'Gaurav', lastName: 'K' },
    });

    await service.create('user-1', 'org-1', { recipientId: 'user-2', title: 'Great work' } as any);

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', orgId: 'org-1', entityId: 'rec-1' }),
    );
  });
});
