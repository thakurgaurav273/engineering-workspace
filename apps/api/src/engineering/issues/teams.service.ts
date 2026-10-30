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
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from "./dto/team.dto";
import { IssueAccess, isOrgAdmin, personSelect } from "./issue-access";
import { DEFAULT_STATES, OPEN_CATEGORIES } from "./workflow";

// Seeded the first time an org creates a team, so the label picker isn't empty.
const DEFAULT_LABELS = [
  { name: "Bug", color: "#ef4444" },
  { name: "Feature", color: "#8b5cf6" },
  { name: "Improvement", color: "#3b82f6" },
];


@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private access: IssueAccess,
  ) {}

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  async list(caller: JwtPayload, includeArchived = false) {
    const teams = await this.prisma.team.findMany({
      where: { orgId: caller.orgId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { name: "asc" },
      include: {
        members: { where: { userId: caller.sub }, select: { role: true } },
        _count: {
          select: {
            members: true,
            issues: {
              where: { deletedAt: null, archivedAt: null, state: { category: { in: OPEN_CATEGORIES } } },
            },
          },
        },
      },
    });
    return teams.map(({ members, _count, ...team }) => ({
      ...team,
      myRole: members[0]?.role ?? null,
      memberCount: _count.members,
      openIssueCount: _count.issues,
    }));
  }

  async findOne(id: string, caller: JwtPayload) {
    await this.access.team(id, caller.orgId, { allowArchived: true });
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          include: { user: { select: personSelect } },
        },
      },
    });
  }

  async create(caller: JwtPayload, dto: CreateTeamDto) {
    if (!isOrgAdmin(caller)) {
      throw new ForbiddenException("Only an admin can create teams");
    }
    try {
      const team = await this.prisma.team.create({
        data: {
          orgId: caller.orgId,
          name: dto.name,
          key: dto.key,
          description: dto.description,
          // The creator leads the team they just made.
          members: { create: { userId: caller.sub, role: "LEAD" } },
          states: { create: DEFAULT_STATES.map((state) => ({ ...state, orgId: caller.orgId })) },
        },
      });
      const labelCount = await this.prisma.issueLabel.count({ where: { orgId: caller.orgId } });
      if (labelCount === 0) {
        await this.prisma.issueLabel.createMany({
          data: DEFAULT_LABELS.map((l) => ({ ...l, orgId: caller.orgId })),
          skipDuplicates: true,
        });
      }
      return team;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`A team with key ${dto.key} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, caller: JwtPayload, dto: UpdateTeamDto) {
    await this.access.team(id, caller.orgId);
    await this.access.assertCanManageTeam(caller, id);
    try {
      return await this.prisma.team.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          // Changing the key re-labels every identifier (ENG-12 -> PLT-12), like Linear.
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

  // Archive instead of delete so issue identifiers and history stay intact.
  async setArchived(id: string, caller: JwtPayload, archived: boolean) {
    if (!isOrgAdmin(caller)) {
      throw new ForbiddenException("Only an admin can archive teams");
    }
    await this.access.team(id, caller.orgId, { allowArchived: true });
    return this.prisma.team.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
  }

  async addMember(id: string, caller: JwtPayload, dto: AddTeamMemberDto) {
    await this.access.team(id, caller.orgId);
    // Anyone may join a team themselves; adding someone else needs management rights,
    // and only managers may hand out LEAD.
    if (dto.userId !== caller.sub || dto.role === "LEAD") {
      await this.access.assertCanManageTeam(caller, id);
    }
    await this.access.assertActiveMember(dto.userId, caller.orgId);

    const role = dto.role ?? "MEMBER";
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: id, userId: dto.userId } },
      create: { teamId: id, userId: dto.userId, role },
      update: { role },
      include: { user: { select: personSelect } },
    });
  }

  async removeMember(id: string, userId: string, caller: JwtPayload) {
    await this.access.team(id, caller.orgId, { allowArchived: true });
    // Anyone may leave a team themselves; removing someone else needs management rights.
    if (userId !== caller.sub) await this.access.assertCanManageTeam(caller, id);

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
