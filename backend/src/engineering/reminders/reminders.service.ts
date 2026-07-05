import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';
import { ReviewsService } from '@/engineering/reviews/reviews.service';
import { DashboardService } from '@/engineering/dashboard/dashboard.service';

interface LocalMoment {
  hhmm: string;
  weekday: number; // 0 = Sunday .. 6 = Saturday
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private reviews: ReviewsService,
    private dashboard: DashboardService,
  ) {}

  // Resolves "now" into a user's own local wall-clock time so reminderTime ("HH:mm") and
  // weeklyReviewReminderDay are compared against what the clock on the user's wall
  // actually reads, not server/UTC time - falls back to UTC for an invalid/unrecognized
  // IANA timezone string rather than skipping every reminder check for that user.
  private localMoment(date: Date, timezone: string): LocalMoment {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      }).formatToParts(date);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return { hhmm: `${get('hour')}:${get('minute')}`, weekday: WEEKDAY_INDEX[get('weekday')] ?? date.getUTCDay() };
    } catch {
      // Invalid/unrecognized IANA timezone string - 'UTC' is always valid, so this
      // recurses exactly once.
      return timezone === 'UTC'
        ? { hhmm: `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`, weekday: date.getUTCDay() }
        : this.localMoment(date, 'UTC');
    }
  }

  // Every 5 minutes - matches the 5-minute-increment time picker in Settings, so a
  // user's chosen reminderTime always lines up with exactly one run in their own timezone.
  @Cron('0 */5 * * * *')
  async sendReminders(): Promise<void> {
    const now = new Date();
    const prefs = await this.prisma.userPreference.findMany({
      where: { OR: [{ dailyCheckinReminder: true }, { weeklyReviewReminder: true }] },
      select: {
        userId: true,
        timezone: true,
        reminderTime: true,
        weeklyReviewReminderDay: true,
        dailyCheckinReminder: true,
        weeklyReviewReminder: true,
      },
    });
    if (!prefs.length) return;

    const results = await Promise.allSettled(prefs.map((pref) => this.maybeRemindUser(pref, now)));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Reminder check failed for a user: ${result.reason}`);
      }
    }
  }

  private async maybeRemindUser(
    pref: {
      userId: string;
      timezone: string;
      reminderTime: string;
      weeklyReviewReminderDay: number;
      dailyCheckinReminder: boolean;
      weeklyReviewReminder: boolean;
    },
    now: Date,
  ): Promise<void> {
    const moment = this.localMoment(now, pref.timezone);
    if (moment.hhmm !== pref.reminderTime) return;

    // A user can belong to multiple orgs - check-in/review state is per-org, so check
    // (and potentially notify) once per org they're an active member of.
    const memberships = await this.prisma.membership.findMany({
      where: { userId: pref.userId, status: MembershipStatus.ACTIVE },
      select: { orgId: true },
    });

    const isWeekday = moment.weekday >= 1 && moment.weekday <= 5;

    for (const { orgId } of memberships) {
      if (pref.dailyCheckinReminder && isWeekday) {
        await this.maybeSendCheckinReminder(pref.userId, orgId);
      }
      if (pref.weeklyReviewReminder && moment.weekday === pref.weeklyReviewReminderDay) {
        await this.maybeSendReviewReminder(pref.userId, orgId);
      }
    }
  }

  private async maybeSendCheckinReminder(userId: string, orgId: string): Promise<void> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const existing = await this.prisma.checkIn.findUnique({
      where: { userId_date: { userId, date: todayStart } },
    });
    if (existing) return;

    await this.notifications.notify({ userId, orgId, ...NotificationTemplates.checkInReminder() });
  }

  private async maybeSendReviewReminder(userId: string, orgId: string): Promise<void> {
    const pending = await this.reviews.findPending(userId, orgId);
    if (!pending.length) return;

    await this.notifications.notify({
      userId,
      orgId,
      ...NotificationTemplates.weeklyReviewReminder(pending.length),
    });
  }

  // Every 15 minutes - not hourly, because real-world UTC offsets include :30 and :45
  // (IST +5:30, Nepal +5:45, etc.); a top-of-UTC-hour check would never line up with
  // local 09:00 for those timezones. 15-minute granularity divides evenly into every
  // real offset, so this always catches the exact local minute. Fires once per user at
  // 9am their local time, every Monday - the digest isn't user-configurable to a
  // specific minute like the reminders above, just "Monday morning" as advertised.
  @Cron('0 */15 * * * *')
  async sendWeeklyDigest(): Promise<void> {
    const now = new Date();
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { weeklyDigest: true },
      select: { userId: true },
    });
    if (!prefs.length) return;

    const timezones = await this.prisma.userPreference.findMany({
      where: { userId: { in: prefs.map((p) => p.userId) } },
      select: { userId: true, timezone: true },
    });
    const timezoneByUser = new Map(timezones.map((t) => [t.userId, t.timezone]));

    const dueUserIds = prefs
      .map((p) => p.userId)
      .filter((userId) => {
        const moment = this.localMoment(now, timezoneByUser.get(userId) ?? 'UTC');
        return moment.weekday === 1 && moment.hhmm === '09:00';
      });
    if (!dueUserIds.length) return;

    const memberships = await this.prisma.membership.findMany({
      where: { userId: { in: dueUserIds }, status: MembershipStatus.ACTIVE },
      select: { userId: true, orgId: true },
    });

    const results = await Promise.allSettled(
      memberships.map(({ userId, orgId }) => this.sendDigestTo(userId, orgId)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Weekly digest failed for a user: ${result.reason}`);
      }
    }
  }

  private async sendDigestTo(userId: string, orgId: string): Promise<void> {
    const dash = await this.dashboard.getDashboard(userId, orgId);
    await this.notifications.notify({
      userId,
      orgId,
      ...NotificationTemplates.weeklyDigest({
        checkInRate: dash.checkInRate,
        blockedMembers: dash.blockedMembers,
        activeGoals: dash.activeGoals,
        recognitionCount: dash.recognitionCount,
      }),
    });
  }
}
