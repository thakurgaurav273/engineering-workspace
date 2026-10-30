import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from "./dto/create-team.dto";

const userSelect = { id: true, firstName: true, lastName: true, avatarUrl: true };

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  private isOrgAdmin(caller: JwtPayload): boolean {
    return caller.role === "OWNER" || caller.role === "ADMIN";
  }

  private async findTeamOrThrow(id: string, orgId: string) {
    const team = await this.prisma.team.findFirst({ where: { id, orgId } });
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  // Org OWNER/ADMIN or a LEAD of this team may manage it.
  private async assertCanManage(caller: JwtPayload, teamId: string): Promise<void> {
    if (this.isOrgAdmin(caller)) return;
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: caller.sub } },
      select: { role: true },
    });
    if (membership?.role !== "LEAD") {
      throw new ForbiddenException("Only a team lead or an admin can manage this team");
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  list(caller: JwtPayload, includeArchived = false) {
    return this.prisma.team.findMany({
      where: { orgId: caller.orgId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { members: true, items: { where: { deletedAt: null } } } },
      },
    });
  }

  async findOne(id: string, caller: JwtPayload) {
    await this.findTeamOrThrow(id, caller.orgId);
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: userSelect } },
        },
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
    });
  }

  async create(caller: JwtPayload, dto: CreateTeamDto) {
    if (!this.isOrgAdmin(caller)) {
      throw new ForbiddenException("Only an admin can create teams");
    }
    try {
      return await this.prisma.team.create({
        data: {
          orgId: caller.orgId,
          name: dto.name,
          key: dto.key,
          description: dto.description,
          // The creator leads the team they just made.
          members: { create: { userId: caller.sub, role: "LEAD" } },
        },
        include: { _count: { select: { members: true } } },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`A team with key ${dto.key} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, caller: JwtPayload, dto: UpdateTeamDto) {
    await this.findTeamOrThrow(id, caller.orgId);
    await this.assertCanManage(caller, id);
    try {
      return await this.prisma.team.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.key !== undefined && { key: dto.key }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`A team with key ${dto.key} already exists`);
      }
      throw error;
    }
  }

  // Archive instead of delete: items keep their teamId so history stays intact, and
  // assertValidTeam stops new work being filed under it.
  async archive(id: string, caller: JwtPayload) {
    if (!this.isOrgAdmin(caller)) {
      throw new ForbiddenException("Only an admin can archive teams");
    }
    await this.findTeamOrThrow(id, caller.orgId);
    return this.prisma.team.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  async addMember(id: string, caller: JwtPayload, dto: AddTeamMemberDto) {
    await this.findTeamOrThrow(id, caller.orgId);
    await this.assertCanManage(caller, id);

    const orgMember = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: dto.userId, orgId: caller.orgId } },
      select: { userId: true },
    });
    if (!orgMember) throw new NotFoundException("User not found in this organization");

    const role = dto.role ?? "MEMBER";
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: id, userId: dto.userId } },
      create: { teamId: id, userId: dto.userId, role },
      update: { role },
      include: { user: { select: userSelect } },
    });
  }

  async removeMember(id: string, userId: string, caller: JwtPayload) {
    await this.findTeamOrThrow(id, caller.orgId);
    // Anyone may leave a team themselves; removing someone else needs management rights.
    if (userId !== caller.sub) await this.assertCanManage(caller, id);

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId } },
      select: { id: true, role: true },
    });
    if (!member) throw new NotFoundException("Team member not found");

    if (member.role === "LEAD") {
      const leads = await this.prisma.teamMember.count({ where: { teamId: id, role: "LEAD" } });
      if (leads <= 1) {
        throw new BadRequestException("A team must keep at least one lead");
      }
    }

    await this.prisma.teamMember.delete({ where: { id: member.id } });
    return { message: "Member removed" };
  }
}
