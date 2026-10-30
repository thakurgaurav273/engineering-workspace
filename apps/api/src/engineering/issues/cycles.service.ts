import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IssueStatus } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { CompleteCycleDto, CreateCycleDto, UpdateCycleDto } from "./dto/cycle.dto";
import { IssueAccess } from "./issue-access";
import { OPEN_STATUSES } from "./issues.service";
import { progressFrom, IssueProgress } from "./projects.service";

type CycleState = "upcoming" | "current" | "past" | "completed";

function stateOf(cycle: { startsAt: Date; endsAt: Date; completedAt: Date | null }, now = new Date()): CycleState {
  if (cycle.completedAt) return "completed";
  if (cycle.endsAt <= now) return "past";
  if (cycle.startsAt <= now) return "current";
  return "upcoming";
}

@Injectable()
export class CyclesService {
  constructor(
    private prisma: PrismaService,
    private access: IssueAccess,
  ) {}

  private async progressByCycle(cycleIds: string[]) {
    const rows = cycleIds.length
      ? await this.prisma.issue.groupBy({
          by: ["cycleId", "status"],
          where: { cycleId: { in: cycleIds }, deletedAt: null },
          _count: { _all: true },
        })
      : [];
    const counts = new Map<string, Partial<Record<IssueStatus, number>>>();
    for (const row of rows) {
      const entry = counts.get(row.cycleId!) ?? {};
      entry[row.status] = row._count._all;
      counts.set(row.cycleId!, entry);
    }
    return new Map<string, IssueProgress>(cycleIds.map((id) => [id, progressFrom(counts.get(id) ?? {})]));
  }

  async list(teamId: string, caller: JwtPayload) {
    await this.access.team(teamId, caller.orgId, { allowArchived: true });
    const cycles = await this.prisma.cycle.findMany({
      where: { teamId },
      orderBy: { startsAt: "desc" },
    });
    const progress = await this.progressByCycle(cycles.map((c) => c.id));
    const now = new Date();
    return cycles.map((c) => ({ ...c, state: stateOf(c, now), progress: progress.get(c.id)! }));
  }

  async findOne(id: string, caller: JwtPayload) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id, orgId: caller.orgId },
      include: { team: { select: { id: true, key: true, name: true } } },
    });
    if (!cycle) throw new NotFoundException("Cycle not found");
    const progress = await this.progressByCycle([id]);
    return { ...cycle, state: stateOf(cycle), progress: progress.get(id)! };
  }

  async create(caller: JwtPayload, dto: CreateCycleDto) {
    await this.access.team(dto.teamId, caller.orgId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    await this.assertWindow(dto.teamId, startsAt, endsAt);

    const cycle = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: dto.teamId },
        data: { cycleCounter: { increment: 1 } },
        select: { cycleCounter: true },
      });
      return tx.cycle.create({
        data: {
          orgId: caller.orgId,
          teamId: dto.teamId,
          number: team.cycleCounter,
          name: dto.name?.trim() || null,
          startsAt,
          endsAt,
        },
      });
    });
    return { ...cycle, state: stateOf(cycle), progress: progressFrom({}) };
  }

  async update(id: string, caller: JwtPayload, dto: UpdateCycleDto) {
    const existing = await this.prisma.cycle.findFirst({ where: { id, orgId: caller.orgId } });
    if (!existing) throw new NotFoundException("Cycle not found");
    if (existing.completedAt) throw new BadRequestException("Completed cycles can't be edited");

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    await this.assertWindow(existing.teamId, startsAt, endsAt, id);

    await this.prisma.cycle.update({
      where: { id },
      data: {
        startsAt,
        endsAt,
        ...(dto.name !== undefined && { name: dto.name?.trim() || null }),
      },
    });
    return this.findOne(id, caller);
  }

  /** Closes a cycle; unfinished issues roll into `rolloverToCycleId` or leave the cycle. */
  async complete(id: string, caller: JwtPayload, dto: CompleteCycleDto) {
    const cycle = await this.prisma.cycle.findFirst({ where: { id, orgId: caller.orgId } });
    if (!cycle) throw new NotFoundException("Cycle not found");
    if (cycle.completedAt) throw new BadRequestException("Cycle is already completed");

    if (dto.rolloverToCycleId) {
      const target = await this.prisma.cycle.findFirst({
        where: { id: dto.rolloverToCycleId, teamId: cycle.teamId, completedAt: null },
      });
      if (!target || target.id === id) throw new BadRequestException("Pick another open cycle of this team");
    }

    await this.prisma.$transaction([
      this.prisma.issue.updateMany({
        where: { cycleId: id, deletedAt: null, status: { in: OPEN_STATUSES } },
        data: { cycleId: dto.rolloverToCycleId ?? null },
      }),
      this.prisma.cycle.update({ where: { id }, data: { completedAt: new Date() } }),
    ]);
    return this.findOne(id, caller);
  }

  // Cycles of one team are sequential sprints, so their windows may not overlap.
  private async assertWindow(teamId: string, startsAt: Date, endsAt: Date, selfId?: string) {
    if (endsAt <= startsAt) throw new BadRequestException("Cycle must end after it starts");
    const overlap = await this.prisma.cycle.findFirst({
      where: {
        teamId,
        ...(selfId && { id: { not: selfId } }),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { number: true },
    });
    if (overlap) throw new BadRequestException(`Overlaps with Cycle ${overlap.number}`);
  }
}
