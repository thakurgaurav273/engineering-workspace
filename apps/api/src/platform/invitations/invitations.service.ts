import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role, MembershipStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/platform/mail/mail.service';
import { AppAccessService } from '@/kernel/app-access/app-access.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private appAccess: AppAccessService,
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

  // Always produces a pending invitation and emails an accept-link, for both
  // brand-new emails and emails that already have an account elsewhere. An
  // existing user gets an INVITED membership row created right away (there's
  // already a User to attach it to); a brand-new email waits until accept()
  // to create anything, same as the token-based flow always intended.
  async create(dto: CreateInvitationDto, orgId: string, invitedById: string) {
    if (dto.role === Role.OWNER) {
      throw new BadRequestException('Cannot invite a user as OWNER');
    }

    const existingPending = await this.prisma.invitation.findFirst({
      where: { orgId, email: dto.email, status: 'pending' },
    });
    if (existingPending) throw new ConflictException('An invitation is already pending for this email');

    const role = dto.role ?? Role.MEMBER;
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId } },
      });
      if (existingMembership && existingMembership.status !== MembershipStatus.LEFT) {
        throw new ConflictException('This person is already a member of your organization');
      }
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const inviter = await this.prisma.user.findUnique({ where: { id: invitedById } });
    const inviterMembership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: invitedById, orgId } },
    });
    const token = crypto.randomBytes(32).toString('hex');

    const invitation = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invitation.create({
        data: {
          orgId,
          email: dto.email,
          token,
          role,
          invitedById,
          expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
        },
        select: this.invitationSelect,
      });

      if (existingUser) {
        await tx.membership.upsert({
          where: { userId_orgId: { userId: existingUser.id, orgId } },
          update: {
            status: MembershipStatus.INVITED,
            role,
            invitedByMembershipId: inviterMembership?.id,
            joinedAt: null,
          },
          create: {
            userId: existingUser.id,
            orgId,
            role,
            status: MembershipStatus.INVITED,
            invitedByMembershipId: inviterMembership?.id,
          },
        });
      }

      return inv;
    });

    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite?token=${token}`;
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'A teammate';
    await this.mail.sendInviteEmail(dto.email, acceptUrl, org?.name ?? 'their organization', inviterName);

    this.logger.log(
      `Invitation sent to ${dto.email} for org ${orgId}${existingUser ? ' (existing account)' : ''}`,
    );
    return invitation;
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
    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    return { email: invitation.email, orgName: invitation.org.name, existingAccount: !!existingUser };
  }

  async revoke(id: string, orgId: string) {
    const invitation = await this.prisma.invitation.findFirst({ where: { id, orgId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.prisma.invitation.update({ where: { id }, data: { status: 'revoked' } });

    // Clean up the placeholder INVITED membership so a cancelled invite
    // doesn't leave a dangling row for an existing-account invitee.
    const user = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (user) {
      await this.prisma.membership.deleteMany({
        where: { userId: user.id, orgId, status: MembershipStatus.INVITED },
      });
    }

    return { message: 'Invitation revoked' };
  }

  async accept(
    token: string,
    dto: { password: string; firstName?: string; lastName?: string },
  ): Promise<{ userId: string; orgId: string }> {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is no longer valid');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    if (existingUser) {
      const passwordValid = await bcrypt.compare(dto.password, existingUser.passwordHash);
      if (!passwordValid) throw new BadRequestException('Incorrect password');

      const membership = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId: invitation.orgId } },
      });
      if (!membership || membership.status !== MembershipStatus.INVITED) {
        throw new BadRequestException('No pending membership found for this invitation');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.membership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.ACTIVE, joinedAt: new Date() },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'accepted', acceptedAt: new Date() },
        });
        // Default-grant every app installed in the org so the invitee can work immediately.
        await this.appAccess.grantDefaultAccess(invitation.orgId, existingUser.id, tx);
      });

      this.logger.log(`Invitation accepted: ${existingUser.email} joined org ${invitation.orgId} (existing account)`);
      return { userId: existingUser.id, orgId: invitation.orgId };
    }

    if (!dto.firstName || !dto.lastName) {
      throw new BadRequestException('First and last name are required');
    }
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const inviterMembership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: invitation.invitedById, orgId: invitation.orgId } },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: dto.firstName!,
          lastName: dto.lastName!,
          orgId: invitation.orgId,
          role: invitation.role,
          defaultOrganizationId: invitation.orgId,
          lastActiveOrganizationId: invitation.orgId,
        },
      });
      await tx.userPreference.create({ data: { userId: u.id } });
      await tx.membership.create({
        data: {
          userId: u.id,
          orgId: invitation.orgId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
          invitedByMembershipId: inviterMembership?.id,
          joinedAt: new Date(),
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      // Default-grant every app installed in the org so the new member can work immediately.
      await this.appAccess.grantDefaultAccess(invitation.orgId, u.id, tx);
      return u;
    });

    this.logger.log(`Invitation accepted: ${user.email} joined org ${invitation.orgId} (new account)`);
    return { userId: user.id, orgId: invitation.orgId };
  }
}
