import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { CreateStateDto, DeleteStateDto, UpdateStateDto } from "./dto/state.dto";
import { IssueAccess } from "./issue-access";
import { sortStates, stateSelect } from "./workflow";

const DEFAULT_COLOR: Record<string, string> = {
  BACKLOG: "#94a3b8",
  UNSTARTED: "#94a3b8",
  STARTED: "#f59e0b",
  COMPLETED: "#6366f1",
  CANCELED: "#64748b",
};

/**
 * A team's workflow states. Any member may add one (it's how the status picker's
 * "Create" works); renaming, re-categorising and deleting need team management rights.
 */
@Injectable()
export class StatesService {
  constructor(
    private prisma: PrismaService,
    private access: IssueAccess,
  ) {}

  /** One team's workflow, or every team's when `teamId` is omitted (cross-team views). */
  async list(caller: JwtPayload, teamId?: string) {
    if (teamId) await this.access.team(teamId, caller.orgId, { allowArchived: true });
    const states = await this.prisma.issueState.findMany({
      where: { orgId: caller.orgId, ...(teamId && { teamId }) },
      select: { ...stateSelect, _count: { select: { issues: { where: { deletedAt: null } } } } },
    });
    return sortStates(states).map(({ _count, ...state }) => ({ ...state, issueCount: _count.issues }));
  }

  async create(caller: JwtPayload, dto: CreateStateDto) {
    await this.access.team(dto.teamId, caller.orgId);
    // New states go last within their category.
    const last = await this.prisma.issueState.aggregate({
      where: { teamId: dto.teamId, category: dto.category },
      _max: { position: true },
    });
    try {
      return await this.prisma.issueState.create({
        data: {
          orgId: caller.orgId,
          teamId: dto.teamId,
          name: dto.name.trim(),
          category: dto.category,
          color: dto.color ?? DEFAULT_COLOR[dto.category],
          position: (last._max.position ?? -1) + 1,
        },
        select: stateSelect,
      });
    } catch (error) {
      throw this.mapConflict(error, dto.name);
    }
  }

  async update(id: string, caller: JwtPayload, dto: UpdateStateDto) {
    const state = await this.findOrThrow(id, caller);
    await this.access.assertCanManageTeam(caller, state.teamId);
    if (dto.category && dto.category !== state.category) await this.assertNotLastUsable(state);
    try {
      return await this.prisma.issueState.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.position !== undefined && { position: dto.position }),
        },
        select: stateSelect,
      });
    } catch (error) {
      throw this.mapConflict(error, dto.name ?? state.name);
    }
  }

  /** Deletes a state, moving its issues to `replacementStateId` (same team) first. */
  async remove(id: string, caller: JwtPayload, dto: DeleteStateDto) {
    const state = await this.findOrThrow(id, caller);
    await this.access.assertCanManageTeam(caller, state.teamId);
    await this.assertNotLastUsable(state);

    const inUse = await this.prisma.issue.count({ where: { stateId: id } });
    if (inUse > 0) {
      if (!dto.replacementStateId) {
        throw new BadRequestException(`${inUse} issue(s) use "${state.name}" - pick a status to move them to`);
      }
      const replacement = await this.prisma.issueState.findFirst({
        where: { id: dto.replacementStateId, teamId: state.teamId },
      });
      if (!replacement || replacement.id === id) {
        throw new BadRequestException("Pick another status of the same team");
      }
    }
    await this.prisma.$transaction([
      // Includes soft-deleted issues: the FK still points at this state.
      ...(inUse > 0
        ? [this.prisma.issue.updateMany({ where: { stateId: id }, data: { stateId: dto.replacementStateId! } })]
        : []),
      this.prisma.issueState.delete({ where: { id } }),
    ]);
    return { message: "Status deleted" };
  }

  // New issues need an open state and finished work needs a completed one, so a team may
  // not lose its last UNSTARTED or COMPLETED state.
  private async assertNotLastUsable(state: { id: string; teamId: string; category: string }) {
    if (state.category !== "UNSTARTED" && state.category !== "COMPLETED") return;
    const others = await this.prisma.issueState.count({
      where: { teamId: state.teamId, category: state.category as "UNSTARTED" | "COMPLETED", id: { not: state.id } },
    });
    if (others === 0) {
      const label = state.category === "UNSTARTED" ? "unstarted" : "completed";
      throw new BadRequestException(`A team needs at least one ${label} status`);
    }
  }

  private async findOrThrow(id: string, caller: JwtPayload) {
    const state = await this.prisma.issueState.findFirst({ where: { id, orgId: caller.orgId } });
    if (!state) throw new NotFoundException("Status not found");
    return state;
  }

  private mapConflict(error: unknown, name: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException(`This team already has a status called "${name.trim()}"`);
    }
    return error;
  }
}
