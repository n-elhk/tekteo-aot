import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { DashboardOverview } from '@org/types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

interface MockPrisma {
  project: {
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  generationHistory: {
    groupBy: ReturnType<typeof vi.fn>;
  };
}

function createMockPrisma(): MockPrisma {
  return {
    project: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    generationHistory: {
      groupBy: vi.fn(),
    },
  };
}

describe('DashboardService.getOverview', () => {
  let service: DashboardService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('aggregates status counts including statuses missing from DB', async () => {
    prisma.project.groupBy.mockResolvedValue([
      { status: 'en_cours', _count: { _all: 5 } },
      { status: 'soumis', _count: { _all: 2 } },
    ]);
    prisma.generationHistory.groupBy.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);

    const result = await service.getOverview();

    expect(result.projectStats).toEqual<DashboardOverview['projectStats']>({
      total: 7,
      byStatus: { brouillon: 0, en_cours: 5, finalise: 0, soumis: 2 },
    });
  });

  it('returns empty token stats when generation_history is empty', async () => {
    prisma.project.groupBy.mockResolvedValue([]);
    prisma.generationHistory.groupBy.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);

    const result = await service.getOverview();

    expect(result.tokenStats).toEqual<DashboardOverview['tokenStats']>({
      totalTokens: 0,
      totalCost: 0,
      byModule: [],
    });
  });

  it('aggregates token stats per module and computes total cost server-side', async () => {
    prisma.project.groupBy.mockResolvedValue([]);
    prisma.generationHistory.groupBy.mockResolvedValue([
      {
        module: 'section',
        modelUsed: 'claude-haiku-4-5',
        _count: { _all: 3 },
        _sum: { tokensUsed: 1_000_000 },
      },
      {
        module: 'section',
        modelUsed: 'claude-sonnet-4-6',
        _count: { _all: 2 },
        _sum: { tokensUsed: 500_000 },
      },
      {
        module: 'cv',
        modelUsed: 'claude-haiku-4-5',
        _count: { _all: 1 },
        _sum: { tokensUsed: 250_000 },
      },
    ]);
    prisma.project.findMany.mockResolvedValue([]);

    const result = await service.getOverview();

    // total tokens = 1_000_000 + 500_000 + 250_000 = 1_750_000
    expect(result.tokenStats.totalTokens).toBe(1_750_000);

    // section: count = 3+2 = 5, tokens = 1_500_000
    // cv: count = 1, tokens = 250_000
    expect(result.tokenStats.byModule).toEqual([
      { module: 'section', count: 5, tokens: 1_500_000 },
      { module: 'cv', count: 1, tokens: 250_000 },
    ]);

    // cost: 1M * 2.72 + 0.5M * 10.2 + 0.25M * 2.72 = 2.72 + 5.1 + 0.68 = 8.5
    expect(result.tokenStats.totalCost).toBeCloseTo(8.5, 5);
  });

  it('returns recent projects ordered by updatedAt desc, capped at 5', async () => {
    prisma.project.groupBy.mockResolvedValue([]);
    prisma.generationHistory.groupBy.mockResolvedValue([]);
    const fakeProjects = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Projet A',
        clientName: 'Client A',
        deadline: new Date('2026-06-01'),
        status: 'en_cours',
        updatedAt: new Date('2026-05-04T10:00:00Z'),
      },
    ];
    prisma.project.findMany.mockResolvedValue(fakeProjects);

    const result = await service.getOverview();

    expect(prisma.project.findMany).toHaveBeenCalledWith({
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
    });

    expect(result.recentProjects).toEqual<DashboardOverview['recentProjects']>([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Projet A',
        clientName: 'Client A',
        deadline: '2026-06-01',
        status: 'en_cours',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
    ]);
  });

  it('handles null deadline correctly', async () => {
    prisma.project.groupBy.mockResolvedValue([]);
    prisma.generationHistory.groupBy.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'No deadline',
        clientName: 'Client B',
        deadline: null,
        status: 'brouillon',
        updatedAt: new Date('2026-05-04T09:00:00Z'),
      },
    ]);

    const result = await service.getOverview();
    expect(result.recentProjects[0].deadline).toBeNull();
  });
});
