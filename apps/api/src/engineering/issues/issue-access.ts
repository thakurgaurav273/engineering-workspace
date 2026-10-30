import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";

export const personSelect = { id: true, firstName: true, lastName: true, avatarUrl: true };

export function isOrgAdmin(caller: JwtPayload): boolean {
  return caller.role === "OWNER" || caller.role === "ADMIN";
}

/**
 * Shared lookups/guards for the Issues module. Visibility follows Linear's default:
 * every org member can see and work on every team's issues; team membership only drives
 * "my teams" and who may manage a team (its LEADs, plus org OWNER/ADMIN).
 */
@Injectable()
export class IssueAccess {
  constructor(private prisma: PrismaService) {}

  async team(teamId: string, orgId: string, opts: { allowArchived?: boolean } = {}) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, orgId } });
    if (!team) throw new NotFoundException("Team not found");
    if (team.archivedAt && !opts.allowArchived) {
      throw new ForbiddenException("This team is archived");
    }
    return team;
  }

  async assertCanManageTeam(caller: JwtPayload, teamId: string): Promise<void> {
    if (isOrgAdmin(caller)) return;
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: caller.sub } },
      select: { role: true },
    });
    if (membership?.role !== "LEAD") {
      throw new ForbiddenException("Only a team lead or an admin can do this");
    }
  }

  async assertActiveMember(userId: string, orgId: string): Promise<void> {
    const member = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { status: true },
    });
    if (!member || member.status !== "ACTIVE") {
      throw new NotFoundException("User not found in this organization");
    }
  }
}
