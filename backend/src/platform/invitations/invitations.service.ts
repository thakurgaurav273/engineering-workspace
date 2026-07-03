import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/platform/mail/mail.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { generateStrongPassword } from '@/common/utils/generate-password';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  private invitationSelect = {
    id: true,
    email: true,
    role: true,
    status: true,
    expiresAt: true,
    createdAt: true,
    invitedBy: { select: { id: true, firstName: true, lastName: true } },
  };

  async create(dto: CreateInvitationDto, orgId: string, invitedById: string) {
    if (dto.role === Role.OWNER) {
      throw new BadRequestException('Cannot invite a user as OWNER');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Email already registered');

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const inviter = await this.prisma.user.findUnique({ where: { id: invitedById } });

    const initialPassword = generateStrongPassword();
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const token = crypto.randomBytes(32).toString('hex');

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          orgId,
          role: dto.role ?? Role.MEMBER,
        },
      });
      await tx.userPreference.create({ data: { userId: u.id } });
      await tx.invitation.create({
        data: {
          orgId,
          email: dto.email,
          token,
          role: dto.role ?? Role.MEMBER,
          invitedById,
          expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
      return u;
    });

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'A teammate';
    await this.mail.sendWelcomeEmail(dto.email, initialPassword, org?.name ?? 'their organization', inviterName, loginUrl);

    this.logger.log(`Account created for ${dto.email} in org ${orgId}, credentials emailed`);
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role };
  }

  async findAllPending(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { orgId, status: 'pending' },
      select: this.invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { org: true },
    });
    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      throw new NotFoundException('Invitation not found or no longer valid');
    }
    return { email: invitation.email, orgName: invitation.org.name };
  }

  async revoke(id: string, orgId: string) {
    const invitation = await this.prisma.invitation.findFirst({ where: { id, orgId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.prisma.invitation.update({ where: { id }, data: { status: 'revoked' } });
    return { message: 'Invitation revoked' };
  }

  async accept(token: string, dto: { password: string; firstName: string; lastName: string }) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is no longer valid');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          orgId: invitation.orgId,
          role: invitation.role,
        },
      });
      await tx.userPreference.create({ data: { userId: u.id } });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      return u;
    });

    this.logger.log(`Invitation accepted: ${user.email} joined org ${invitation.orgId}`);
    return user;
  }
}
