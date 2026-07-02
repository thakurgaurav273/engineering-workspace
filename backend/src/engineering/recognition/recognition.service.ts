import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRecognitionDto } from './dto/create-recognition.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(private prisma: PrismaService) {}

  private readonly recognitionSelect = {
    id: true,
    title: true,
    note: true,
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

    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.recipientId, orgId, isActive: true },
    });
    if (!recipient) throw new NotFoundException('Recipient not found in this organization');

    const recognition = await this.prisma.recognition.create({
      data: {
        orgId,
        authorId,
        recipientId: dto.recipientId,
        title: dto.title,
        note: dto.note,
      },
      select: this.recognitionSelect,
    });

    this.logger.log(`Recognition created: ${recognition.id} by ${authorId}`);
    return recognition;
  }

  async findAll(orgId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { orgId };

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

  async findByUser(targetUserId: string, orgId: string, pagination: PaginationDto) {
    // Verify target user is in org
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, orgId },
    });
    if (!targetUser) throw new NotFoundException('User not found in this organization');

    const { page = 1, limit = 20 } = pagination;
    const where = { recipientId: targetUserId, orgId };

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
