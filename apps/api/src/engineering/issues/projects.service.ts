import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { CreateProjectDto, ListProjectsDto, UpdateProjectDto } from "./dto/project.dto";
import { IssueAccess, isOrgAdmin, personSelect } from "./issue-access";
import { progressBy, progressFrom } from "./workflow";

const projectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  leadId: true,
  startDate: true,
  targetDate: true,
  completedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  lead: { select: personSelect },
  teams: { select: { id: true, key: true, name: true }, orderBy: { name: "asc" as const } },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private access: IssueAccess,
  ) {}

  private progressByProject(projectIds: string[]) {
    return progressBy(this.prisma, "projectId", projectIds);
  }

  async list(caller: JwtPayload, query: ListProjectsDto) {
    const projects = await this.prisma.project.findMany({
      where: {
        orgId: caller.orgId,
        ...(query.includeArchived ? {} : { archivedAt: null }),
        ...(query.teamId && { teams: { some: { id: query.teamId } } }),
      },
      select: projectSelect,
      orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });
    const progress = await this.progressByProject(projects.map((p) => p.id));
    return projects.map((p) => ({ ...p, progress: progress.get(p.id)! }));
  }

  async findOne(id: string, caller: JwtPayload) {
    const project = await this.prisma.project.findFirst({
      where: { id, orgId: caller.orgId },
      select: projectSelect,
    });
    if (!project) throw new NotFoundException("Project not found");
    const progress = await this.progressByProject([id]);
    return { ...project, progress: progress.get(id)! };
  }

  async create(caller: JwtPayload, dto: CreateProjectDto) {
    await this.validate(caller, dto);
    const project = await this.prisma.project.create({
      data: {
        orgId: caller.orgId,
        name: dto.name.trim(),
        description: dto.description,
        status: dto.status ?? "PLANNED",
        leadId: dto.leadId ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        ...(dto.status === "COMPLETED" && { completedAt: new Date() }),
        ...(dto.teamIds?.length && { teams: { connect: dto.teamIds.map((id) => ({ id })) } }),
      },
      select: projectSelect,
    });
    return { ...project, progress: progressFrom({}) };
  }

  async update(id: string, caller: JwtPayload, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findFirst({ where: { id, orgId: caller.orgId } });
    if (!existing) throw new NotFoundException("Project not found");
    await this.validate(caller, dto);

    const start = dto.startDate !== undefined ? dto.startDate : existing.startDate?.toISOString();
    const target = dto.targetDate !== undefined ? dto.targetDate : existing.targetDate?.toISOString();
    if (start && target && new Date(target) < new Date(start)) {
      throw new BadRequestException("Target date must be after the start date");
    }

    await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.leadId !== undefined && { leadId: dto.leadId }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.targetDate !== undefined && { targetDate: dto.targetDate ? new Date(dto.targetDate) : null }),
        ...(dto.status !== undefined && {
          status: dto.status,
          completedAt: dto.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
        }),
        ...(dto.teamIds !== undefined && { teams: { set: dto.teamIds.map((teamId) => ({ id: teamId })) } }),
      },
    });
    return this.findOne(id, caller);
  }

  async setArchived(id: string, caller: JwtPayload, archived: boolean) {
    const existing = await this.prisma.project.findFirst({ where: { id, orgId: caller.orgId } });
    if (!existing) throw new NotFoundException("Project not found");
    if (!isOrgAdmin(caller) && existing.leadId !== caller.sub) {
      throw new ForbiddenException("Only the project lead or an admin can archive a project");
    }
    await this.prisma.project.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    return this.findOne(id, caller);
  }

  private async validate(caller: JwtPayload, dto: UpdateProjectDto) {
    if (dto.leadId) await this.access.assertActiveMember(dto.leadId, caller.orgId);
    if (dto.teamIds?.length) {
      const ids = [...new Set(dto.teamIds)];
      const found = await this.prisma.team.count({ where: { id: { in: ids }, orgId: caller.orgId } });
      if (found !== ids.length) throw new NotFoundException("Team not found");
    }
    if (dto.startDate && dto.targetDate && new Date(dto.targetDate) < new Date(dto.startDate)) {
      throw new BadRequestException("Target date must be after the start date");
    }
  }
}
