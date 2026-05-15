import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { Prisma } from '../../generated/prisma/client';
import { ConsultantsService } from './consultants.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';

describe('ConsultantsService.create', () => {
  let service: ConsultantsService;
  let prisma: { consultant: { create: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prisma = { consultant: { create: vi.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnthropicService, useValue: {} },
        { provide: GenerationHistoryService, useValue: { record: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ConsultantsService);
  });

  it('persists firstName, lastName, email and masterCvData', async () => {
    prisma.consultant.create.mockResolvedValue({ id: 'c1' });
    await service.create('user1', {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@example.com',
      masterCvData: { identity: { firstName: 'Jean' } } as unknown as Prisma.InputJsonValue,
    });
    expect(prisma.consultant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.com',
        createdById: 'user1',
      }),
    });
  });
});

describe('ConsultantsService.importFromText', () => {
  it('extracts identity from cvData and creates a Consultant', async () => {
    const prisma = { consultant: { create: vi.fn().mockResolvedValue({ id: 'c2' }) } };
    const anthropic = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          identity: { firstName: 'Marie', lastName: 'Durand', email: 'marie@x.fr', role: 'Dev' },
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
        modelUsed: 'claude-x',
      }),
    };
    const history = { record: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnthropicService, useValue: anthropic },
        { provide: GenerationHistoryService, useValue: history },
      ],
    }).compile();
    const svc = moduleRef.get(ConsultantsService);

    const result = await svc.importFromText('user1', {
      cvText: 'a'.repeat(60),
      persist: true,
    });

    expect(prisma.consultant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Marie',
        lastName: 'Durand',
        email: 'marie@x.fr',
        role: 'Dev',
        createdById: 'user1',
      }),
    });
    expect(result.consultant).toEqual({ id: 'c2' });
  });
});
