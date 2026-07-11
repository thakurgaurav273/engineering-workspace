import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEvent {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only platform audit trail. `record` is best-effort - an audit write must never break the
 * action it is auditing, so failures are logged and swallowed. Reads are paginated for the admin UI.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.action,
          actorId: event.actorId ?? null,
          actorEmail: event.actorEmail ?? null,
          targetType: event.targetType ?? null,
          targetId: event.targetId ?? null,
          orgId: event.orgId ?? null,
          metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit event "${event.action}": ${err instanceof Error ? err.message : err}`);
    }
  }

  async list(params: { page: number; limit: number; action?: string }) {
    const where: Prisma.AuditLogWhereInput = params.action ? { action: params.action } : {};
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { rows, total };
  }

  /** Distinct action keys currently present - powers the filter dropdown. */
  async actions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
