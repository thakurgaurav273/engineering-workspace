import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  private userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    orgId: true,
    managerId: true,
    jobTitle: true,
    department: true,
    isActive: true,
    createdAt: true,
    manager: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
  };

  async findAll(
    orgId: string,
    pagination: PaginationDto,
    search?: string,
    isActive?: boolean,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { jobTitle: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.userSelect,
        skip,
        take: limit,
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, orgId },
      select: { ...this.userSelect, preference: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, orgId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle,
          department: dto.department,
          managerId: dto.managerId,
          orgId,
        },
        select: this.userSelect,
      });
      await tx.userPreference.create({ data: { userId: u.id } });
      return u;
    });

    this.logger.log(`User created: ${user.email} in org ${orgId}`);
    return user;
  }

  async update(id: string, orgId: string, dto: UpdateUserDto, requesterId: string) {
    const user = await this.findOne(id, orgId);

    if (id !== requesterId) {
      const isManager = await this.prisma.user.findFirst({
        where: { id, managerId: requesterId, orgId },
      });
      if (!isManager) {
        throw new ForbiddenException('Cannot update this user');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.managerId !== undefined) updateData.managerId = dto.managerId;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: this.userSelect,
    });
  }

  async deactivate(id: string, orgId: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('Cannot deactivate yourself');
    await this.findOne(id, orgId);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: this.userSelect,
    });
  }

  async updateAvatar(id: string, orgId: string, avatarUrl: string, requesterId: string) {
    if (id !== requesterId) throw new ForbiddenException('Can only update your own avatar');
    await this.findOne(id, orgId);
    return this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: this.userSelect,
    });
  }

  async getPreference(userId: string, orgId: string) {
    await this.findOne(userId, orgId);
    return this.prisma.userPreference.findUnique({ where: { userId } });
  }

  async updatePreference(
    userId: string,
    orgId: string,
    dto: {
      timezone?: string;
      emailNotifications?: boolean;
      weeklyDigest?: boolean;
      theme?: string;
    },
  ) {
    await this.findOne(userId, orgId);
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
