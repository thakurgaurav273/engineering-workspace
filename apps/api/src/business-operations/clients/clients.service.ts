import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, query: ListClientsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? 'desc';

    const where: Prisma.ClientWhereInput = {
      orgId,
      archivedAt: query.archived === 'true' ? { not: null } : null,
    };
    if (query.type) where.type = query.type;
    if (query.active !== undefined) where.isActive = query.active === 'true';
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactPersonName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return { success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, orgId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, orgId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  create(orgId: string, dto: CreateClientDto) {
    return this.prisma.client.create({ data: { orgId, ...dto } });
  }

  async update(id: string, orgId: string, dto: UpdateClientDto) {
    await this.findOne(id, orgId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  /** Soft delete — sets archivedAt. No hard delete. */
  async archive(id: string, orgId: string) {
    await this.findOne(id, orgId);
    return this.prisma.client.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  async restore(id: string, orgId: string) {
    await this.findOne(id, orgId);
    return this.prisma.client.update({ where: { id }, data: { archivedAt: null } });
  }
}
