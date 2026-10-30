import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { JwtPayload } from "@/common/decorators/current-user.decorator";
import { CreateLabelDto, UpdateLabelDto } from "./dto/label.dto";
import { IssueAccess, isOrgAdmin } from "./issue-access";

@Injectable()
export class LabelsService {
  constructor(
    private prisma: PrismaService,
    private access: IssueAccess,
  ) {}

  /** Workspace labels plus, when `teamId` is given, that team's own labels. */
  list(caller: JwtPayload, teamId?: string) {
    return this.prisma.issueLabel.findMany({
      where: { orgId: caller.orgId, OR: [{ teamId: null }, ...(teamId ? [{ teamId }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, teamId: true },
    });
  }

  async create(caller: JwtPayload, dto: CreateLabelDto) {
    if (dto.teamId) await this.access.team(dto.teamId, caller.orgId);
    try {
      return await this.prisma.issueLabel.create({
        data: { orgId: caller.orgId, teamId: dto.teamId ?? null, name: dto.name.trim(), color: dto.color },
        select: { id: true, name: true, color: true, teamId: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(`Label "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, caller: JwtPayload, dto: UpdateLabelDto) {
    await this.findOrThrow(id, caller);
    return this.prisma.issueLabel.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name.trim() }), ...(dto.color && { color: dto.color }) },
      select: { id: true, name: true, color: true, teamId: true },
    });
  }

  async remove(id: string, caller: JwtPayload) {
    const label = await this.findOrThrow(id, caller);
    if (label.teamId) await this.access.assertCanManageTeam(caller, label.teamId);
    else if (!isOrgAdmin(caller)) throw new ForbiddenException("Only an admin can delete workspace labels");
    await this.prisma.issueLabel.delete({ where: { id } });
    return { message: "Label deleted" };
  }

  private async findOrThrow(id: string, caller: JwtPayload) {
    const label = await this.prisma.issueLabel.findFirst({ where: { id, orgId: caller.orgId } });
    if (!label) throw new NotFoundException("Label not found");
    return label;
  }
}
