import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorkspaceReminderStage, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';
import { isStagingSafeMode } from '@/common/safe-mode';

@Injectable()
export class WorkspaceRemindersService {
  private readonly logger = new Logger(WorkspaceRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }

  private addDays(d: Date, days: number): Date {
    const copy = new Date(d);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  // Runs once a day. `reminderStage` remembers the most advanced reminder already sent
  // so a single item is never notified twice for the same milestone across daily runs.
  @Cron('0 0 9 * * *')
  async sendDueDateReminders(): Promise<void> {
    if (isStagingSafeMode()) {
      this.logger.warn('STAGING_SAFE_MODE on - skipping workspace due-date reminders');
      return;
    }
    const todayStart = this.startOfDay(new Date());
    const tomorrowStart = this.addDays(todayStart, 1);
    const dayAfterTomorrowStart = this.addDays(todayStart, 2);

    const [dueSoon, dueToday, overdue] = await Promise.all([
      this.prisma.workspaceItem.findMany({
        where: {
          deletedAt: null,
          archivedAt: null,
          status: { not: WorkspaceStatus.DONE },
          dueDate: { gte: tomorrowStart, lt: dayAfterTomorrowStart },
          reminderStage: WorkspaceReminderStage.NONE,
        },
        select: { id: true, orgId: true, ownerId: true, title: true },
      }),
      this.prisma.workspaceItem.findMany({
        where: {
          deletedAt: null,
          archivedAt: null,
          status: { not: WorkspaceStatus.DONE },
          dueDate: { gte: todayStart, lt: tomorrowStart },
          reminderStage: { in: [WorkspaceReminderStage.NONE, WorkspaceReminderStage.DUE_SOON] },
        },
        select: { id: true, orgId: true, ownerId: true, title: true },
      }),
      this.prisma.workspaceItem.findMany({
        where: {
          deletedAt: null,
          archivedAt: null,
          status: { not: WorkspaceStatus.DONE },
          dueDate: { lt: todayStart },
          reminderStage: { not: WorkspaceReminderStage.OVERDUE },
        },
        select: { id: true, orgId: true, ownerId: true, title: true },
      }),
    ]);

    const batches: Array<{
      items: typeof dueSoon;
      stage: WorkspaceReminderStage;
      kind: 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE';
    }> = [
      { items: dueSoon, stage: WorkspaceReminderStage.DUE_SOON, kind: 'DUE_SOON' },
      { items: dueToday, stage: WorkspaceReminderStage.DUE_TODAY, kind: 'DUE_TODAY' },
      { items: overdue, stage: WorkspaceReminderStage.OVERDUE, kind: 'OVERDUE' },
    ];

    const results = await Promise.allSettled(
      batches.flatMap(({ items, stage, kind }) =>
        items.map((item) => this.remindOne(item, stage, kind)),
      ),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Workspace reminder failed: ${result.reason}`);
      }
    }

    this.logger.log(
      `Workspace reminders sent - dueSoon: ${dueSoon.length}, dueToday: ${dueToday.length}, overdue: ${overdue.length}`,
    );
  }

  private async remindOne(
    item: { id: string; orgId: string; ownerId: string; title: string },
    stage: WorkspaceReminderStage,
    kind: 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE',
  ): Promise<void> {
    const payload = NotificationTemplates.workspaceItemReminder(kind, item.id, item.title);
    await this.notifications.notify({ userId: item.ownerId, orgId: item.orgId, ...payload });
    await this.prisma.workspaceItem.update({ where: { id: item.id }, data: { reminderStage: stage } });
  }
}
