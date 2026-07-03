import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LinearClient } from '@linear/sdk';
import { PrismaService } from '@/prisma/prisma.service';
import { encrypt, decrypt } from '@/common/utils/encryption';

export interface CompletedIssueMetric {
  count: number;
  points: number;
}

export interface LinearIssueDetail {
  identifier: string;
  title: string;
  url: string;
  stateName: string;
  stateType: string;
  dueDate: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  estimate: number | null;
  isOverdue: boolean;
  missedDeadline: boolean;
}

export interface LinearUserActivity {
  summary: {
    totalAssigned: number;
    totalDone: number;
    totalInReview: number;
    totalOverdue: number;
  };
  issues: LinearIssueDetail[];
}

interface RawIssueNode {
  identifier: string;
  title: string;
  url: string;
  dueDate: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  estimate: number | null;
  assignee: { email: string } | null;
  state: { name: string; type: string };
}

interface IssuesResponse {
  issues: {
    nodes: RawIssueNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

const COMPLETED_ISSUES_QUERY = `
  query CompletedIssues($since: DateTimeOrDuration!, $after: String) {
    issues(
      filter: { completedAt: { gte: $since } }
      first: 250
      after: $after
    ) {
      nodes {
        estimate
        completedAt
        assignee { email }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const USER_ISSUES_QUERY = `
  query UserIssues($email: String!, $after: String) {
    issues(
      filter: { assignee: { email: { eq: $email } } }
      first: 100
      after: $after
    ) {
      nodes {
        identifier
        title
        url
        dueDate
        completedAt
        canceledAt
        estimate
        assignee { email }
        state { name type }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

@Injectable()
export class LinearIntegrationService {
  private readonly logger = new Logger(LinearIntegrationService.name);

  constructor(private prisma: PrismaService) {}

  private async getClient(orgId: string): Promise<LinearClient | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { linearApiKey: true },
    });
    if (!org?.linearApiKey) return null;
    return new LinearClient({ apiKey: decrypt(org.linearApiKey) });
  }

  async connect(orgId: string, apiKey: string) {
    const client = new LinearClient({ apiKey });

    let viewerName: string;
    let workspaceName: string;
    try {
      const [viewer, organization] = await Promise.all([client.viewer, client.organization]);
      viewerName = viewer.name;
      workspaceName = organization.name;
    } catch {
      throw new BadRequestException('Could not connect to Linear — check that the API key is valid.');
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { linearApiKey: encrypt(apiKey), linearWorkspaceName: workspaceName, linearConnectedAt: new Date() },
    });

    this.logger.log(`Linear connected for org ${orgId} as ${viewerName} (workspace: ${workspaceName})`);
    return { connected: true, workspaceName, connectedAsName: viewerName };
  }

  async getStatus(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { linearApiKey: true, linearWorkspaceName: true, linearConnectedAt: true },
    });
    return {
      connected: !!org?.linearApiKey,
      workspaceName: org?.linearWorkspaceName ?? null,
      connectedAt: org?.linearConnectedAt ?? null,
    };
  }

  async disconnect(orgId: string) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { linearApiKey: null, linearWorkspaceName: null, linearConnectedAt: null },
    });
    return { message: 'Linear disconnected' };
  }

  /** Completed-issue counts/points per assignee email since `sinceDate`. Null if org has no Linear connection or the fetch failed. */
  async getCompletedIssuesByEmail(orgId: string, sinceDate: Date): Promise<Map<string, CompletedIssueMetric> | null> {
    const client = await this.getClient(orgId);
    if (!client) return null;

    const result = new Map<string, CompletedIssueMetric>();
    let after: string | undefined;
    let pages = 0;

    try {
      do {
        const data = await client.client.request<
          { issues: { nodes: { estimate: number | null; completedAt: string | null; assignee: { email: string } | null }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } },
          { since: string; after?: string }
        >(COMPLETED_ISSUES_QUERY, { since: sinceDate.toISOString(), after });

        for (const issue of data.issues.nodes) {
          const email = issue.assignee?.email;
          if (!email || !issue.completedAt) continue;
          const existing = result.get(email) ?? { count: 0, points: 0 };
          existing.count += 1;
          existing.points += issue.estimate ?? 0;
          result.set(email, existing);
        }

        after = data.issues.pageInfo.hasNextPage ? (data.issues.pageInfo.endCursor ?? undefined) : undefined;
        pages += 1;
      } while (after && pages < 10);
    } catch (err) {
      this.logger.error(`Failed to fetch Linear issues for org ${orgId}`, err as Error);
      return null;
    }

    return result;
  }

  /** Full ticket-level activity for one person, for admin drill-down. Null if not connected or the fetch failed. */
  async getUserActivity(orgId: string, email: string): Promise<LinearUserActivity | null> {
    const client = await this.getClient(orgId);
    if (!client) return null;

    const nodes: RawIssueNode[] = [];
    let after: string | undefined;
    let pages = 0;

    try {
      do {
        const data = await client.client.request<IssuesResponse, { email: string; after?: string }>(
          USER_ISSUES_QUERY,
          { email, after },
        );
        nodes.push(...data.issues.nodes);
        after = data.issues.pageInfo.hasNextPage ? (data.issues.pageInfo.endCursor ?? undefined) : undefined;
        pages += 1;
      } while (after && pages < 10);
    } catch (err) {
      this.logger.error(`Failed to fetch Linear activity for ${email} in org ${orgId}`, err as Error);
      return null;
    }

    const now = new Date();
    const issues: LinearIssueDetail[] = nodes.map((n) => {
      const isOpen = !n.completedAt && !n.canceledAt;
      const isOverdue = isOpen && !!n.dueDate && new Date(n.dueDate) < now;
      const missedDeadline = !!n.dueDate && !!n.completedAt && new Date(n.completedAt) > new Date(n.dueDate);
      return {
        identifier: n.identifier,
        title: n.title,
        url: n.url,
        stateName: n.state.name,
        stateType: n.state.type,
        dueDate: n.dueDate,
        completedAt: n.completedAt,
        canceledAt: n.canceledAt,
        estimate: n.estimate,
        isOverdue,
        missedDeadline,
      };
    });

    // Most urgent/active first: overdue, then open (by due date), then done/canceled, most recent first.
    issues.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const aOpen = !a.completedAt && !a.canceledAt;
      const bOpen = !b.completedAt && !b.canceledAt;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    });

    const summary = {
      totalAssigned: issues.filter((i) => !i.completedAt && !i.canceledAt).length,
      totalDone: issues.filter((i) => !!i.completedAt).length,
      totalInReview: issues.filter((i) => !i.completedAt && !i.canceledAt && i.stateName.toLowerCase().includes('review')).length,
      totalOverdue: issues.filter((i) => i.isOverdue).length,
    };

    return { summary, issues };
  }
}
