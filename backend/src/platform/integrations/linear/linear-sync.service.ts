import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LinearClient } from '@linear/sdk';
import { LinearWorkflowType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { decrypt } from '@/common/utils/encryption';
import { NotificationsService } from '@/platform/notifications/notifications.service';
import { NotificationTemplates } from '@/platform/notifications/notification-templates';

interface RawAssignedIssueNode {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number | null;
  estimate: number | null;
  dueDate: string | null;
  assignee: { email: string } | null;
  state: { name: string; type: string };
}

interface WorkspaceIssuesResponse {
  issues: {
    nodes: RawAssignedIssueNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

const WORKSPACE_ASSIGNED_ISSUES_QUERY = `
  query WorkspaceAssignedIssues($after: String) {
    issues(
      filter: { assignee: { null: false } }
      first: 250
      after: $after
    ) {
      nodes {
        id
        identifier
        title
        url
        priority
        estimate
        dueDate
        assignee { email }
        state { name type }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export interface SyncResult {
  skipped: boolean;
  synced: number;
  archived: number;
}

@Injectable()
export class LinearSyncService {
  private readonly logger = new Logger(LinearSyncService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // One workspace-wide query per org, every 15 minutes — never one call per engineer.
  @Cron('0 */15 * * * *')
  async syncAllConnectedOrgs(): Promise<void> {
    const orgs = await this.prisma.organization.findMany({
      where: { linearConnectedAt: { not: null } },
      select: { id: true },
    });

    const results = await Promise.allSettled(orgs.map((org) => this.syncAssignedIssues(org.id)));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Scheduled Linear sync failed for an org: ${result.reason}`);
      }
    }
  }

  async syncAssignedIssues(orgId: string): Promise<SyncResult> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { linearApiKey: true },
    });
    if (!org?.linearApiKey) return { skipped: true, synced: 0, archived: 0 };

    const client = new LinearClient({ apiKey: decrypt(org.linearApiKey) });
    const users = await this.prisma.user.findMany({
      where: { orgId },
      select: { id: true, email: true },
    });
    const userByEmail = new Map(users.map((u) => [u.email, u.id]));

    const existingIssues = await this.prisma.linearIssue.findMany({
      where: { orgId },
      select: { id: true, linearId: true, assigneeId: true, archivedAt: true },
    });
    const existingByLinearId = new Map(existingIssues.map((i) => [i.linearId, i]));

    const nodes: RawAssignedIssueNode[] = [];
    let after: string | undefined;
    let pages = 0;

    try {
      do {
        const data = await client.client.request<WorkspaceIssuesResponse, { after?: string }>(
          WORKSPACE_ASSIGNED_ISSUES_QUERY,
          { after },
        );
        nodes.push(...data.issues.nodes);
        after = data.issues.pageInfo.hasNextPage ? (data.issues.pageInfo.endCursor ?? undefined) : undefined;
        pages += 1;
      } while (after && pages < 10);
    } catch (err) {
      this.logger.error(`Failed to fetch Linear issues for org ${orgId}`, err as Error);
      return { skipped: true, synced: 0, archived: 0 };
    }

    const seenLinearIds = new Set<string>();
    let synced = 0;

    for (const node of nodes) {
      seenLinearIds.add(node.id);
      const assigneeId = node.assignee?.email ? (userByEmail.get(node.assignee.email) ?? null) : null;
      const existing = existingByLinearId.get(node.id);
      const isNewAssignment = !!assigneeId && (!existing || existing.archivedAt !== null || existing.assigneeId !== assigneeId);

      const data = {
        identifier: node.identifier,
        title: node.title,
        url: node.url,
        stateName: node.state.name,
        stateType: node.state.type as LinearWorkflowType,
        priority: node.priority,
        estimate: node.estimate,
        dueDate: node.dueDate ? new Date(node.dueDate) : null,
        assigneeId,
        syncedAt: new Date(),
        archivedAt: null,
      };

      const upserted = await this.prisma.linearIssue.upsert({
        where: { orgId_linearId: { orgId, linearId: node.id } },
        create: { orgId, linearId: node.id, ...data },
        update: data,
      });
      synced += 1;

      if (isNewAssignment && assigneeId) {
        const payload = NotificationTemplates.linearIssueAssigned(node.identifier, node.title, upserted.id);
        await this.notifications.notify({ userId: assigneeId, orgId, ...payload });
      }
    }

    const toArchive = existingIssues.filter((i) => !i.archivedAt && !seenLinearIds.has(i.linearId));
    if (toArchive.length) {
      await this.prisma.linearIssue.updateMany({
        where: { id: { in: toArchive.map((i) => i.id) } },
        data: { archivedAt: new Date() },
      });
    }

    this.logger.log(`Linear sync for org ${orgId}: ${synced} synced, ${toArchive.length} archived`);
    return { skipped: false, synced, archived: toArchive.length };
  }
}
