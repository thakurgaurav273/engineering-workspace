import { Injectable } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

const RESULTS_PER_TYPE = 5;

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(orgId: string, q: string) {
    const [people, goals, checkIns] = await Promise.all([
      this.prisma.membership.findMany({
        where: {
          orgId,
          status: MembershipStatus.ACTIVE,
          OR: [
            { user: { firstName: { contains: q, mode: 'insensitive' } } },
            { user: { lastName: { contains: q, mode: 'insensitive' } } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { jobTitle: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          jobTitle: true,
          department: true,
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        take: RESULTS_PER_TYPE,
      }),

      this.prisma.goal.findMany({
        where: { orgId, title: { contains: q, mode: 'insensitive' } },
        select: { id: true, title: true, status: true, progress: true },
        orderBy: { updatedAt: 'desc' },
        take: RESULTS_PER_TYPE,
      }),

      this.prisma.checkIn.findMany({
        where: { orgId, summary: { contains: q, mode: 'insensitive' } },
        select: {
          id: true,
          summary: true,
          status: true,
          date: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        take: RESULTS_PER_TYPE,
      }),
    ]);

    return {
      people: people.map((m) => ({
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        avatarUrl: m.user.avatarUrl,
        jobTitle: m.jobTitle,
        department: m.department,
      })),
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        status: g.status,
        progress: g.progress,
      })),
      checkIns: checkIns.map((c) => ({
        id: c.id,
        summary: c.summary,
        status: c.status,
        date: c.date,
        userId: c.user.id,
        userName: `${c.user.firstName} ${c.user.lastName}`,
      })),
    };
  }
}
