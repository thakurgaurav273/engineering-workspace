import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRecognitionDto } from './dto/create-recognition.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private readonly recognitionSelect = {
    id: true,
    title: true,
    note: true,
    isPrivate: true,
    createdAt: true,
    orgId: true,
    authorId: true,
    recipientId: true,
    author: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
    },
    recipient: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: true },
    },
  };

  async create(authorId: string, orgId: string, dto: CreateRecognitionDto) {
    if (authorId === dto.recipientId) {
      throw new BadRequestException('Cannot recognize yourself');
    }

    const recipient = await this.prisma.membership.findFirst({
      where: { userId: dto.recipientId, orgId, status: MembershipStatus.ACTIVE },
    });
    if (!recipient) throw new NotFoundException('Recipient not found in this organization');

    // Snapshot the author's sharing preference at creation time - a later preference
    // change shouldn't retroactively flip the visibility of recognitions already given.
    const authorPreference = await this.prisma.userPreference.findUnique({
      where: { userId: authorId },
      select: { autoShareRecognition: true },
    });
    const isPrivate = authorPreference ? !authorPreference.autoShareRecognition : false;

    const recognition = await this.prisma.recognition.create({
      data: {
        orgId,
        authorId,
        recipientId: dto.recipientId,
        title: dto.title,
        note: dto.note,
        isPrivate,
      },
      select: this.recognitionSelect,
    });

    this.logger.log(`Recognition created: ${recognition.id} by ${authorId}`);

    const { type, title, body, entityType, entityId, actionUrl, metadata } = NotificationTemplates.recognitionReceived(
      `${recognition.author.firstName} ${recognition.author.lastName}`,
      recognition.title,
      recognition.id,
      recognition.author.avatarUrl,
    );
    await this.notifications.notify({
      userId: recognition.recipientId,
      orgId,
      type,
      title,
      body,
      entityType,
      entityId,
      actionUrl,
      metadata,
    });

    return recognition;
  }

  async findAll(orgId: string, requesterId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    // Private recognitions are excluded from the shared feed for everyone except the
    // author/recipient themselves, who should still see their own either way.
    const where = {
      orgId,
      OR: [{ isPrivate: false }, { authorId: requesterId }, { recipientId: requesterId }],
    };

    const [data, total] = await Promise.all([
      this.prisma.recognition.findMany({
        where,
        select: this.recognitionSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recognition.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findMine(userId: string, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { recipientId: userId, orgId };

    const [data, total] = await Promise.all([
      this.prisma.recognition.findMany({
        where,
        select: this.recognitionSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recognition.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findGiven(userId: string, orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { authorId: userId, orgId };

    const [data, total] = await Promise.all([
      this.prisma.recognition.findMany({
        where,
        select: this.recognitionSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recognition.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findByUser(targetUserId: string, orgId: string, requesterId: string, pagination: PaginationDto) {
    // Verify target user is in org
    const targetMembership = await this.prisma.membership.findFirst({
      where: { userId: targetUserId, orgId },
    });
    if (!targetMembership) throw new NotFoundException('User not found in this organization');

    const { page = 1, limit = 20 } = pagination;
    const where = {
      recipientId: targetUserId,
      orgId,
      ...(requesterId !== targetUserId && { OR: [{ isPrivate: false }, { authorId: requesterId }] }),
    };

    const [data, total] = await Promise.all([
      this.prisma.recognition.findMany({
        where,
        select: this.recognitionSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recognition.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }
}
