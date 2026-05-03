import { Injectable } from '@nestjs/common';
import { Prisma, type GenerationModule } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface RecordGenerationInput {
  module: GenerationModule;
  projectId?: string | null;
  userId?: string | null;
  inputData?: Prisma.InputJsonValue;
  outputContent?: string;
  modelUsed?: string;
  tokensUsed?: number;
}

export interface FindAllFilter {
  module?: GenerationModule;
  projectId?: string;
  userId?: string;
  /** ISO 8601 date strings (YYYY-MM-DD) */
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

@Injectable()
export class GenerationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordGenerationInput) {
    return this.prisma.generationHistory.create({
      data: {
        module: input.module,
        projectId: input.projectId ?? null,
        generatedById: input.userId ?? null,
        inputData: input.inputData ?? Prisma.JsonNull,
        outputContent: input.outputContent ?? null,
        modelUsed: input.modelUsed ?? null,
        tokensUsed: input.tokensUsed ?? null,
      },
    });
  }

  async findAll(filter: FindAllFilter) {
    const where = this.buildWhere(filter);
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, filter.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const [items, total] = await Promise.all([
      this.prisma.generationHistory.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          generatedBy: { select: { id: true, email: true, fullName: true } },
          project: { select: { id: true, name: true, clientName: true } },
        },
      }),
      this.prisma.generationHistory.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  findByProject(projectId: string) {
    return this.prisma.generationHistory.findMany({
      where: { projectId },
      orderBy: { generatedAt: 'desc' },
      include: {
        generatedBy: { select: { id: true, email: true, fullName: true } },
      },
      take: 100,
    });
  }

  /**
   * Statistiques agrégées : tokens et nombre d'appels par module.
   */
  async getStats(filter: FindAllFilter) {
    const where = this.buildWhere(filter);

    const grouped = await this.prisma.generationHistory.groupBy({
      by: ['module'],
      where,
      _count: { _all: true },
      _sum: { tokensUsed: true },
    });

    const totalTokens = grouped.reduce(
      (sum, g) => sum + (g._sum.tokensUsed ?? 0),
      0,
    );
    const totalCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

    return {
      byModule: grouped.map((g) => ({
        module: g.module,
        count: g._count._all,
        tokens: g._sum.tokensUsed ?? 0,
      })),
      totalTokens,
      totalCount,
    };
  }

  private buildWhere(filter: FindAllFilter): Prisma.GenerationHistoryWhereInput {
    const where: Prisma.GenerationHistoryWhereInput = {};
    if (filter.module) where.module = filter.module;
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.userId) where.generatedById = filter.userId;
    if (filter.fromDate || filter.toDate) {
      where.generatedAt = {};
      if (filter.fromDate) where.generatedAt.gte = new Date(filter.fromDate);
      if (filter.toDate) {
        // Include the whole day
        const to = new Date(filter.toDate);
        to.setHours(23, 59, 59, 999);
        where.generatedAt.lte = to;
      }
    }
    return where;
  }
}
