import { Injectable } from '@nestjs/common';
import type { DashboardOverview } from '@org/types';
import type {
  GenerationModule,
  ProjectStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeCost } from './anthropic-pricing';

const ALL_STATUSES: ProjectStatus[] = [
  'brouillon',
  'en_cours',
  'finalise',
  'soumis',
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<DashboardOverview> {
    const [statusGroups, generationGroups, recentProjects] = await Promise.all([
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.generationHistory.groupBy({
        by: ['module', 'modelUsed'],
        _count: { _all: true },
        _sum: { tokensUsed: true },
      }),
      this.prisma.project.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          clientName: true,
          deadline: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      projectStats: buildProjectStats(statusGroups),
      tokenStats: buildTokenStats(generationGroups),
      recentProjects: recentProjects.map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        deadline: p.deadline ? toIsoDate(p.deadline) : null,
        status: p.status,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }
}

interface StatusGroup {
  status: ProjectStatus;
  _count: { _all: number };
}

function buildProjectStats(
  groups: StatusGroup[],
): DashboardOverview['projectStats'] {
  const byStatus: Record<ProjectStatus, number> = {
    brouillon: 0,
    en_cours: 0,
    finalise: 0,
    soumis: 0,
  };
  for (const status of ALL_STATUSES) byStatus[status] = 0;
  for (const g of groups) byStatus[g.status] = g._count._all;
  const total = ALL_STATUSES.reduce((s, k) => s + byStatus[k], 0);
  return { total, byStatus };
}

interface GenerationGroup {
  module: GenerationModule;
  modelUsed: string | null;
  _count: { _all: number };
  _sum: { tokensUsed: number | null };
}

function buildTokenStats(
  groups: GenerationGroup[],
): DashboardOverview['tokenStats'] {
  const perModule = new Map<
    GenerationModule,
    { count: number; tokens: number }
  >();
  let totalTokens = 0;
  let totalCost = 0;

  for (const g of groups) {
    const tokens = g._sum.tokensUsed ?? 0;
    totalTokens += tokens;
    totalCost += computeCost(tokens, g.modelUsed);

    const existing = perModule.get(g.module) ?? { count: 0, tokens: 0 };
    existing.count += g._count._all;
    existing.tokens += tokens;
    perModule.set(g.module, existing);
  }

  const byModule = Array.from(perModule.entries()).map(([module, agg]) => ({
    module,
    count: agg.count,
    tokens: agg.tokens,
  }));

  return { totalTokens, totalCost, byModule };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
