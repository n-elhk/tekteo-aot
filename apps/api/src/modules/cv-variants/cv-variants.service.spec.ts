import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { CvVariantsService } from './cv-variants.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';

describe('CvVariantsService.create', () => {
  it('calls Anthropic with master cvData + jobProfile and inserts a variant', async () => {
    const consultant = {
      id: 'c1',
      masterCvData: { identity: { firstName: 'Marie' } },
    };
    const jobProfile = {
      id: 'jp1',
      title: 'Dev Backend',
      experienceLevel: 'senior',
      requiredSkills: ['Node'],
      optionalSkills: [],
      missions: 'Construire X',
      education: 'Bac+5',
      projectId: 'p1',
    };
    const prisma = {
      consultant: { findUnique: vi.fn().mockResolvedValue(consultant) },
      jobProfile: { findUnique: vi.fn().mockResolvedValue(jobProfile) },
      cvVariant: { create: vi.fn().mockResolvedValue({ id: 'v1' }) },
    };
    const anthropic = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({ identity: { firstName: 'Marie' }, skills: [{ name: 'Node' }] }),
        usage: { inputTokens: 100, outputTokens: 200 },
        modelUsed: 'claude-x',
      }),
    };
    const history = { record: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CvVariantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnthropicService, useValue: anthropic },
        { provide: GenerationHistoryService, useValue: history },
      ],
    }).compile();
    const svc = moduleRef.get(CvVariantsService);

    const result = await svc.create('c1', 'user1', {
      jobProfileId: 'jp1',
      template: 'tekteo',
    });

    expect(prisma.cvVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consultantId: 'c1',
        jobProfileId: 'jp1',
        template: 'tekteo',
        createdById: 'user1',
        name: expect.stringContaining('Dev Backend'),
      }),
    });
    expect(history.record).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'cv',
        inputData: expect.objectContaining({ mode: 'create-variant' }),
      }),
    );
    expect(result.variant).toEqual({ id: 'v1' });
  });
});
