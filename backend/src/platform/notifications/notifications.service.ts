import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { PushService } from './push/push.service';
import { NotificationsGateway } from './notifications.gateway';
import { categoryForType } from './notification-templates';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

export interface NotifyInput {
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private gateway: NotificationsGateway,
  ) {}

  private readonly notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    entityType: true,
    entityId: true,
    actionUrl: true,
    metadata: true,
    isRead: true,
    createdAt: true,
    readAt: true,
  };

  async notify(input: NotifyInput): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
        actionUrl: input.actionUrl,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      select: this.notificationSelect,
    });

    // Never let a channel failure propagate — the caller's business action must always succeed.
    const results = await Promise.allSettled([
      this.sendPushIfAllowed(input),
      Promise.resolve(this.gateway.emitToUser(input.userId, 'notification:new', notification)),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Notification channel failed: ${result.reason}`);
      }
    }
  }

  private async sendPushIfAllowed(input: NotifyInput): Promise<void> {
    const pref = await this.getOrCreatePreference(input.userId);
    const category = categoryForType(input.type);
    if (pref[category] === false) return;

    const stringData: Record<string, string> = { type: input.type };
    if (input.entityType) stringData.entityType = input.entityType;
    if (input.entityId) stringData.entityId = input.entityId;
    if (input.actionUrl) stringData.actionUrl = input.actionUrl;

    await this.push.sendToUser(input.userId, { title: input.title, body: input.body, data: stringData });
  }

  async registerDevice(userId: string, orgId: string, dto: RegisterDeviceDto) {
    return this.prisma.pushDevice.upsert({
      where: { token: dto.token },
      update: {
        userId,
        orgId,
        platform: dto.platform,
        browser: dto.browser,
        deviceName: dto.deviceName,
        active: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        orgId,
        token: dto.token,
        platform: dto.platform,
        browser: dto.browser,
        deviceName: dto.deviceName,
      },
    });
  }

  async unregisterDevice(userId: string, token: string) {
    const device = await this.prisma.pushDevice.findFirst({ where: { token, userId } });
    if (!device) throw new NotFoundException('Device not found');
    await this.prisma.pushDevice.delete({ where: { token } });
    return { message: 'Device unregistered' };
  }

  async list(userId: string, orgId: string, query: ListNotificationsDto) {
    const { page = 1, limit = 20, isRead } = query;
    const where = { userId, orgId, ...(isRead !== undefined && { isRead }) };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: this.notificationSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async markRead(id: string, userId: string, orgId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId, orgId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      select: this.notificationSelect,
    });
  }

  async markAllRead(userId: string, orgId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, orgId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  async remove(id: string, userId: string, orgId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId, orgId } });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }

  async unreadCount(userId: string, orgId: string) {
    const count = await this.prisma.notification.count({ where: { userId, orgId, isRead: false } });
    return { count };
  }

  async getPreferences(userId: string) {
    return this.getOrCreatePreference(userId);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: { ...dto },
      create: { userId, ...dto },
    });
  }

  private async getOrCreatePreference(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }
}
