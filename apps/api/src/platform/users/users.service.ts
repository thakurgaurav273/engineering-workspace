import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role, MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/platform/mail/mail.service';
import { StorageService } from '@/platform/storage/storage.service';
import { AvatarUploadUrlDto, AVATAR_MIME_EXT } from './dto/avatar-upload.dto';
import { SignatureUploadUrlDto, SIGNATURE_MIME_EXT } from './dto/signature-upload.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { paginate, PaginationDto } from '@/common/dto/pagination.dto';
import { generateStrongPassword } from '@/common/utils/generate-password';

type RoleValue = 'OWNER' | 'ADMIN' | 'MEMBER';

const membershipViewInclude = {
  user: {
    select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, signatureUrl: true },
  },
  manager: {
    select: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.MembershipInclude;

type MembershipView = Prisma.MembershipGetPayload<{ include: typeof membershipViewInclude }>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private storage: StorageService,
  ) {}

  // Flattens a Membership (+ joined User) back into the shape every existing
  // caller (frontend, other services) already expects from the old User-only
  // model - org-specific fields come off the membership, identity fields off
  // the user, `createdAt` becomes this org's join date rather than the
  // account's global creation date.
  private toUserView(m: MembershipView) {
    return {
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      signatureUrl: m.user.signatureUrl,
      orgId: m.orgId,
      managerId: m.manager?.user.id ?? null,
      jobTitle: m.jobTitle,
      department: m.department,
      role: m.role,
      isActive: m.status === MembershipStatus.ACTIVE,
      status: m.status,
      createdAt: m.joinedAt ?? m.createdAt,
      manager: m.manager
        ? {
            id: m.manager.user.id,
            firstName: m.manager.user.firstName,
            lastName: m.manager.user.lastName,
            avatarUrl: m.manager.user.avatarUrl,
          }
        : null,
    };
  }

  // Keeps the legacy User columns valid for any reader that hasn't moved to
  // Membership yet, mirroring whichever org is currently the one being
  // written to (mirrors AuthService.syncLegacyUserFields - duplicated rather
  // than shared to avoid a cross-module dependency for a handful of lines).
  private async syncLegacyUserFields(userId: string, orgId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { manager: { select: { userId: true } } },
    });
    if (!membership) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.lastActiveOrganizationId !== orgId) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: membership.role,
        managerId: membership.manager?.userId ?? null,
        department: membership.department,
        jobTitle: membership.jobTitle,
        isActive: membership.status === MembershipStatus.ACTIVE,
      },
    });
  }

  private async resolveManagerMembershipId(
    managerId: string | null | undefined,
    orgId: string,
  ): Promise<string | null> {
    if (!managerId) return null;
    const mgrMembership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: managerId, orgId } },
    });
    return mgrMembership?.id ?? null;
  }

  // Who can act on whom: OWNER and ADMIN both manage ADMIN/MEMBER,
  // nobody manages OWNER through these endpoints.
  private canManage(actorRole: RoleValue, targetRole: RoleValue): boolean {
    if (targetRole === 'OWNER') return false;
    return actorRole === 'OWNER' || actorRole === 'ADMIN';
  }

  async findAll(
    orgId: string,
    pagination: PaginationDto,
    search?: string,
    isActive?: boolean,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.MembershipWhereInput = {
      orgId,
      status: { not: MembershipStatus.LEFT },
      ...(isActive !== undefined && {
        status: isActive ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
      }),
      ...(search && {
        OR: [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.membership.findMany({
        where,
        include: membershipViewInclude,
        skip,
        take: limit,
        orderBy: { user: { firstName: 'asc' } },
      }),
      this.prisma.membership.count({ where }),
    ]);

    return paginate(rows.map((m) => this.toUserView(m)), total, page, limit);
  }

  async findOne(id: string, orgId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: id, orgId },
      include: { ...membershipViewInclude, user: { include: { preference: true } } },
    });
    if (!membership) throw new NotFoundException('User not found');
    return { ...this.toUserView(membership), preference: membership.user.preference };
  }

  async create(dto: CreateUserDto, orgId: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId } },
      });
      if (existingMembership) throw new ConflictException('This person is already a member of your organization');

      const managerMembershipId = await this.resolveManagerMembershipId(dto.managerId, orgId);
      const membership = await this.prisma.membership.create({
        data: {
          userId: existingUser.id,
          orgId,
          role: Role.MEMBER,
          status: MembershipStatus.ACTIVE,
          department: dto.department,
          jobTitle: dto.jobTitle,
          managerId: managerMembershipId,
          joinedAt: new Date(),
        },
        include: membershipViewInclude,
      });

      this.logger.log(`Existing user ${existingUser.email} added to org ${orgId}`);
      return this.toUserView(membership);
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const managerMembershipId = await this.resolveManagerMembershipId(dto.managerId, orgId);

    const membership = await this.prisma.$transaction(async (tx) => {
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
          defaultOrganizationId: orgId,
          lastActiveOrganizationId: orgId,
        },
      });
      await tx.userPreference.create({ data: { userId: u.id } });
      return tx.membership.create({
        data: {
          userId: u.id,
          orgId,
          role: Role.MEMBER,
          status: MembershipStatus.ACTIVE,
          department: dto.department,
          jobTitle: dto.jobTitle,
          managerId: managerMembershipId,
          joinedAt: new Date(),
        },
        include: membershipViewInclude,
      });
    });

    this.logger.log(`User created: ${dto.email} in org ${orgId}`);
    return this.toUserView(membership);
  }

  async update(id: string, orgId: string, dto: UpdateUserDto, requesterId: string, requesterRole: RoleValue) {
    await this.findOne(id, orgId);

    if (id !== requesterId && requesterRole === 'MEMBER') {
      const targetMembership = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId: id, orgId } },
        select: { manager: { select: { userId: true } } },
      });
      if (targetMembership?.manager?.userId !== requesterId) {
        throw new ForbiddenException('Cannot update this user');
      }
    }

    const membershipUpdate: Prisma.MembershipUpdateInput = {};
    if (dto.jobTitle !== undefined) membershipUpdate.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) membershipUpdate.department = dto.department;
    if (dto.managerId !== undefined) {
      const managerMembershipId = await this.resolveManagerMembershipId(dto.managerId, orgId);
      membershipUpdate.manager = managerMembershipId
        ? { connect: { id: managerMembershipId } }
        : { disconnect: true };
    }

    const userUpdate: Record<string, unknown> = {};
    if (dto.firstName !== undefined) userUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) userUpdate.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) userUpdate.avatarUrl = dto.avatarUrl;

    if (Object.keys(membershipUpdate).length > 0) {
      await this.prisma.membership.update({
        where: { userId_orgId: { userId: id, orgId } },
        data: membershipUpdate,
      });
    }
    // Capture the avatar being replaced (if any) so we can reclaim the old object.
    let replacedAvatarUrl: string | null = null;
    if (dto.avatarUrl !== undefined) {
      const prev = await this.prisma.user.findUnique({
        where: { id },
        select: { avatarUrl: true },
      });
      if (prev?.avatarUrl && prev.avatarUrl !== dto.avatarUrl) {
        replacedAvatarUrl = prev.avatarUrl;
      }
    }

    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id }, data: userUpdate });
    }
    await this.syncLegacyUserFields(id, orgId);

    if (replacedAvatarUrl) {
      await this.storage.deleteByPublicUrl(replacedAvatarUrl);
    }

    return this.findOne(id, orgId);
  }

  async updateRole(id: string, orgId: string, role: Role, requesterId: string, requesterRole: RoleValue) {
    if (id === requesterId) throw new ForbiddenException('Cannot change your own role');
    if (role === 'OWNER') throw new BadRequestException('Cannot grant OWNER through this action');

    const target = await this.findOne(id, orgId);
    if (!this.canManage(requesterRole, target.role as RoleValue)) {
      throw new ForbiddenException('Cannot change this user\'s role');
    }

    this.logger.log(`Role changed: ${target.email} -> ${role} by ${requesterId}`);
    await this.prisma.membership.update({
      where: { userId_orgId: { userId: id, orgId } },
      data: { role },
    });
    await this.syncLegacyUserFields(id, orgId);
    return this.findOne(id, orgId);
  }

  async updateStatus(id: string, orgId: string, isActive: boolean, requesterId: string, requesterRole: RoleValue) {
    if (id === requesterId) throw new ForbiddenException(`Cannot ${isActive ? 'reactivate' : 'deactivate'} yourself`);

    const target = await this.findOne(id, orgId);
    if (!this.canManage(requesterRole, target.role as RoleValue)) {
      throw new ForbiddenException(`Cannot ${isActive ? 'reactivate' : 'deactivate'} this user`);
    }

    this.logger.log(`Status changed: ${target.email} -> isActive=${isActive} by ${requesterId}`);
    await this.prisma.membership.update({
      where: { userId_orgId: { userId: id, orgId } },
      data: { status: isActive ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED },
    });
    await this.syncLegacyUserFields(id, orgId);
    return this.findOne(id, orgId);
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

  /**
   * Issues a short-lived presigned PUT URL so the browser can upload a new avatar
   * directly to R2 (the file never passes through this API). MIME type and size are
   * validated here and pinned into the signature; the object key is generated as
   * avatars/{userId}/{uuid}.{ext} - the client filename is never trusted.
   */
  async createAvatarUploadUrl(
    id: string,
    orgId: string,
    requesterId: string,
    dto: AvatarUploadUrlDto,
  ) {
    if (id !== requesterId) throw new ForbiddenException('Can only upload your own avatar');
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File uploads are not available right now');
    }
    await this.findOne(id, orgId);

    const ext = AVATAR_MIME_EXT[dto.contentType];
    if (!ext) throw new BadRequestException('Unsupported image type');

    const key = this.storage.buildKey(`avatars/${id}`, ext);
    return this.storage.presignUpload({
      key,
      contentType: dto.contentType,
      contentLength: dto.size,
    });
  }

  async updateAvatar(id: string, orgId: string, avatarUrl: string, requesterId: string) {
    if (id !== requesterId) throw new ForbiddenException('Can only update your own avatar');
    await this.findOne(id, orgId);

    const previous = await this.prisma.user.findUnique({
      where: { id },
      select: { avatarUrl: true },
    });

    await this.prisma.user.update({ where: { id }, data: { avatarUrl } });

    // Reclaim the old object so replaced avatars don't accumulate in the bucket.
    // Best-effort and scoped to our own bucket (external URLs are left untouched).
    if (previous?.avatarUrl && previous.avatarUrl !== avatarUrl) {
      await this.storage.deleteByPublicUrl(previous.avatarUrl);
    }

    return this.findOne(id, orgId);
  }

  /** Presigned PUT for a signature image - same direct-to-R2 flow as avatars. */
  async createSignatureUploadUrl(
    id: string,
    orgId: string,
    requesterId: string,
    dto: SignatureUploadUrlDto,
  ) {
    if (id !== requesterId) throw new ForbiddenException('Can only upload your own signature');
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File uploads are not available right now');
    }
    await this.findOne(id, orgId);

    const ext = SIGNATURE_MIME_EXT[dto.contentType];
    if (!ext) throw new BadRequestException('Unsupported image type');

    const key = this.storage.buildKey(`signatures/${id}`, ext);
    return this.storage.presignUpload({
      key,
      contentType: dto.contentType,
      contentLength: dto.size,
    });
  }

  /** Persist a signature URL. Passing null/empty clears it. Old object is reclaimed. */
  async updateSignature(id: string, orgId: string, signatureUrl: string | null, requesterId: string) {
    if (id !== requesterId) throw new ForbiddenException('Can only update your own signature');
    await this.findOne(id, orgId);

    const previous = await this.prisma.user.findUnique({
      where: { id },
      select: { signatureUrl: true },
    });

    const next = signatureUrl && signatureUrl.trim() ? signatureUrl : null;
    await this.prisma.user.update({ where: { id }, data: { signatureUrl: next } });

    if (previous?.signatureUrl && previous.signatureUrl !== next) {
      await this.storage.deleteByPublicUrl(previous.signatureUrl);
    }

    return this.findOne(id, orgId);
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
      theme?: string;
      dailyCheckinReminder?: boolean;
      weeklyReviewReminder?: boolean;
      reminderTime?: string;
      weeklyReviewReminderDay?: number;
      autoShareRecognition?: boolean;
      defaultApplicationKey?: string | null;
    },
  ) {
    if (userId !== requesterId) throw new ForbiddenException('Cannot update another user\'s preferences');
    await this.findOne(userId, orgId);

    if (dto.reminderTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dto.reminderTime)) {
      throw new BadRequestException('reminderTime must be in HH:mm 24-hour format');
    }
    if (
      dto.weeklyReviewReminderDay !== undefined &&
      (!Number.isInteger(dto.weeklyReviewReminderDay) ||
        dto.weeklyReviewReminderDay < 0 ||
        dto.weeklyReviewReminderDay > 6)
    ) {
      throw new BadRequestException('weeklyReviewReminderDay must be an integer between 0 (Sunday) and 6 (Saturday)');
    }

    return this.prisma.userPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
