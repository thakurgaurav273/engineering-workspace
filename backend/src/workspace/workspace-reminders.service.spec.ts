import { WorkspaceRemindersService } from './workspace-reminders.service';

describe('WorkspaceRemindersService', () => {
  let service: WorkspaceRemindersService;
  let prisma: any;
  let notifications: any;

  beforeEach(() => {
    prisma = {
      workspaceItem: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    service = new WorkspaceRemindersService(prisma, notifications);
  });

  it('does nothing when no items are due', async () => {
    await service.sendDueDateReminders();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(prisma.workspaceItem.update).not.toHaveBeenCalled();
  });

  it('notifies and stamps reminderStage for a due-tomorrow item', async () => {
    prisma.workspaceItem.findMany
      .mockResolvedValueOnce([{ id: 'wi-1', orgId: 'org-1', ownerId: 'user-1', title: 'Call client' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.sendDueDateReminders();

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', orgId: 'org-1', type: 'WORKSPACE_ITEM_REMINDER' }),
    );
    expect(prisma.workspaceItem.update).toHaveBeenCalledWith({
      where: { id: 'wi-1' },
      data: { reminderStage: 'DUE_SOON' },
    });
  });

  it('notifies for an overdue item and stamps OVERDUE', async () => {
    prisma.workspaceItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'wi-2', orgId: 'org-1', ownerId: 'user-2', title: 'Old task' }]);

    await service.sendDueDateReminders();

    expect(prisma.workspaceItem.update).toHaveBeenCalledWith({
      where: { id: 'wi-2' },
      data: { reminderStage: 'OVERDUE' },
    });
  });

  it('continues past a single notification failure without throwing', async () => {
    prisma.workspaceItem.findMany
      .mockResolvedValueOnce([{ id: 'wi-1', orgId: 'org-1', ownerId: 'user-1', title: 'A' }])
      .mockResolvedValueOnce([{ id: 'wi-2', orgId: 'org-1', ownerId: 'user-2', title: 'B' }])
      .mockResolvedValueOnce([]);
    notifications.notify.mockRejectedValueOnce(new Error('push failed')).mockResolvedValueOnce(undefined);

    await expect(service.sendDueDateReminders()).resolves.toBeUndefined();
    expect(prisma.workspaceItem.update).toHaveBeenCalledTimes(1);
  });
});
