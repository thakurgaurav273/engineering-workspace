import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/platform/mail/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { generateStrongPassword } from '@/common/utils/generate-password';

type RoleValue = 'OWNER' | 'ADMIN' | 'MEMBER';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

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
    role: true,
    isActive: true,
    createdAt: true,
    manager: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
  };

  // Who can act on whom: OWNER manages ADMIN/MEMBER, ADMIN manages MEMBER only,
  // nobody manages OWNER through these endpoints.
  private canManage(actorRole: RoleValue, targetRole: RoleValue): boolean {
    if (targetRole === 'OWNER') return false;
    if (actorRole === 'OWNER') return true;
    if (actorRole === 'ADMIN') return targetRole === 'MEMBER';
    return false;
  }

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

  async update(id: string, orgId: string, dto: UpdateUserDto, requesterId: string, requesterRole: RoleValue) {
    const user = await this.findOne(id, orgId);

    if (id !== requesterId && requesterRole === 'MEMBER') {
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

  async updateRole(id: string, orgId: string, role: Role, requesterId: string, requesterRole: RoleValue) {
    if (id === requesterId) throw new ForbiddenException('Cannot change your own role');
    if (role === 'OWNER') throw new BadRequestException('Cannot grant OWNER through this action');

    const target = await this.findOne(id, orgId);
    if (!this.canManage(requesterRole, target.role as RoleValue)) {
      throw new ForbiddenException('Cannot change this user\'s role');
    }

    this.logger.log(`Role changed: ${target.email} -> ${role} by ${requesterId}`);
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: this.userSelect,
    });
  }

  async updateStatus(id: string, orgId: string, isActive: boolean, requesterId: string, requesterRole: RoleValue) {
    if (id === requesterId) throw new ForbiddenException(`Cannot ${isActive ? 'reactivate' : 'deactivate'} yourself`);

    const target = await this.findOne(id, orgId);
    if (!this.canManage(requesterRole, target.role as RoleValue)) {
      throw new ForbiddenException(`Cannot ${isActive ? 'reactivate' : 'deactivate'} this user`);
    }

    this.logger.log(`Status changed: ${target.email} -> isActive=${isActive} by ${requesterId}`);
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: this.userSelect,
    });
  }

  async deactivate(id: string, orgId: string, requesterId: string, requesterRole: RoleValue) {
    return this.updateStatus(id, orgId, false, requesterId, requesterRole);
  }

  async resetPassword(id: string, orgId: string, requesterId: string, requesterRole: RoleValue) {
    const target = await this.findOne(id, orgId);
    if (!this.canManage(requesterRole, target.role as RoleValue)) {
      throw new ForbiddenException('Cannot reset this user\'s password');
    }

    const newPassword = generateStrongPassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
    await this.mail.sendPasswordResetEmail(target.email, newPassword, org?.name ?? 'your organization', loginUrl);

    this.logger.log(`Password reset for ${target.email} by ${requesterId}`);
    return { message: 'New password emailed to user' };
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

  async getPreference(userId: string, orgId: string, requesterId: string) {
    if (userId !== requesterId) throw new ForbiddenException('Cannot view another user\'s preferences');
    await this.findOne(userId, orgId);
    return this.prisma.userPreference.findUnique({ where: { userId } });
  }

  async updatePreference(
    userId: string,
    orgId: string,
    requesterId: string,
    dto: {
      timezone?: string;
      emailNotifications?: boolean;
      weeklyDigest?: boolean;
      theme?: string;
      dailyCheckinReminder?: boolean;
      weeklyReviewReminder?: boolean;
      autoShareRecognition?: boolean;
      showMenteeSuggestions?: boolean;
      notifyNewRecognition?: boolean;
      notifyCheckInBlockers?: boolean;
      notifyReviewRequests?: boolean;
    },
  ) {
    if (userId !== requesterId) throw new ForbiddenException('Cannot update another user\'s preferences');
    await this.findOne(userId, orgId);
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
