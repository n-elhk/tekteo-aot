import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  AdaptCvToJobDto,
  CreateConsultantCvDto,
  CvData,
  FormatCvFromTextDto,
  UpdateConsultantCvDto,
} from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import {
  ADAPT_SYSTEM_PROMPT,
  FORMAT_SYSTEM_PROMPT,
  buildAdaptPrompt,
  buildFormatPrompt,
  type JobProfilePayload,
} from './cv-prompts';
import { GeneratedCvsService } from './generated-cvs.service';

@Injectable()
export class ConsultantCvsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
    private readonly generatedCvs: GeneratedCvsService,
  ) {}

  // --------------------------------------------------------
  // CRUD
  // --------------------------------------------------------
  async findAll(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.consultantCv.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          createdBy: { select: { id: true, email: true, fullName: true } },
          _count: { select: { jobProfiles: true } },
          generatedCvs: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              template: true,
              status: true,
              updatedAt: true,
              jobs: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      }),
      this.prisma.consultantCv.count(),
    ]);

    return {
      items: items.map((c) => {
        const latestRaw = c.generatedCvs[0] ?? null;
        return {
          ...c,
          latestGeneratedCv: latestRaw
            ? {
                id: latestRaw.id,
                template: latestRaw.template,
                status: latestRaw.status,
                updatedAt: latestRaw.updatedAt,
                jobId: latestRaw.jobs[0]?.id ?? null,
              }
            : null,
          generatedCvs: undefined,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const cv = await this.prisma.consultantCv.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        jobProfiles: {
          select: { id: true, title: true, projectId: true },
        },
        generatedCvs: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            template: true,
            status: true,
            filename: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!cv) throw new NotFoundException(`Consultant ${id} introuvable`);
    return cv;
  }

  create(userId: string, dto: CreateConsultantCvDto) {
    return this.prisma.consultantCv.create({
      data: {
        cvData: dto.cvData as Prisma.InputJsonValue,
        consultantName: dto.consultantName ?? null,
        consultantTitle: dto.consultantTitle ?? null,
        createdById: userId,
      },
    });
  }

  async update(id: string, dto: UpdateConsultantCvDto) {
    await this.findOne(id);
    return this.prisma.consultantCv.update({
      where: { id },
      data: {
        ...(dto.cvData !== undefined && {
          cvData: dto.cvData as Prisma.InputJsonValue,
        }),
        ...(dto.consultantName !== undefined && {
          consultantName: dto.consultantName,
        }),
        ...(dto.consultantTitle !== undefined && {
          consultantTitle: dto.consultantTitle,
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Purge des fichiers PDF avant cascade Prisma (sinon orphelins dans le storage)
    await this.generatedCvs.purgeForConsultant(id);
    return this.prisma.consultantCv.delete({ where: { id } });
  }

  // --------------------------------------------------------
  // Génération IA — extraction depuis texte brut (Anthropic)
  // --------------------------------------------------------
  async formatFromText(userId: string, dto: FormatCvFromTextDto) {
    const generation = await this.anthropic.generate({
      systemPrompt: FORMAT_SYSTEM_PROMPT,
      userMessage: buildFormatPrompt(dto.cvText),
      maxTokens: 8192,
    });

    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed =
      generation.usage.inputTokens + generation.usage.outputTokens;

    await this.history.record({
      module: 'cv',
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: JSON.stringify(cvData).slice(0, 4000),
      inputData: { mode: 'format', textLength: dto.cvText.length },
    });

    if (dto.persist) {
      const persisted = await this.prisma.consultantCv.create({
        data: {
          cvData: cvData as unknown as Prisma.InputJsonValue,
          consultantName: extractIdentityName(cvData),
          consultantTitle: extractIdentityRole(cvData),
          createdById: userId,
        },
      });
      return {
        cv: persisted,
        usage: { tokensUsed, modelUsed: generation.modelUsed },
      };
    }

    return {
      cv: null,
      cvData,
      usage: { tokensUsed, modelUsed: generation.modelUsed },
    };
  }

  // --------------------------------------------------------
  // Adaptation à une fiche de poste (Anthropic)
  // --------------------------------------------------------
  async adaptToJob(cvId: string, userId: string, dto: AdaptCvToJobDto) {
    const sourceCv = await this.findOne(cvId);
    const jobProfile = await this.prisma.jobProfile.findUnique({
      where: { id: dto.jobProfileId },
    });
    if (!jobProfile) {
      throw new NotFoundException(
        `Fiche de poste ${dto.jobProfileId} introuvable`,
      );
    }

    const payload: JobProfilePayload = {
      title: jobProfile.title,
      experienceLevel: jobProfile.experienceLevel,
      requiredSkills: jobProfile.requiredSkills,
      optionalSkills: jobProfile.optionalSkills,
      missions: jobProfile.missions,
      education: jobProfile.education,
    };

    const generation = await this.anthropic.generate({
      systemPrompt: ADAPT_SYSTEM_PROMPT,
      userMessage: buildAdaptPrompt(sourceCv.cvData, payload),
      maxTokens: 16_000,
    });

    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed =
      generation.usage.inputTokens + generation.usage.outputTokens;

    const adaptedCv = await this.prisma.consultantCv.create({
      data: {
        cvData: cvData as unknown as Prisma.InputJsonValue,
        consultantName:
          extractIdentityName(cvData) ?? sourceCv.consultantName,
        consultantTitle: extractIdentityRole(cvData) ?? jobProfile.title,
        createdById: userId,
      },
    });

    if (dto.link) {
      await this.prisma.jobProfile.update({
        where: { id: jobProfile.id },
        data: { cvId: adaptedCv.id },
      });
    }

    await this.history.record({
      module: 'cv',
      projectId: jobProfile.projectId ?? undefined,
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Adapté depuis CV ${cvId} vers fiche ${jobProfile.title}`,
      inputData: {
        mode: 'adapt',
        sourceCvId: cvId,
        jobProfileId: jobProfile.id,
        link: dto.link,
      },
    });

    return {
      cv: adaptedCv,
      usage: { tokensUsed, modelUsed: generation.modelUsed },
    };
  }
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function extractIdentityName(cvData: CvData): string | null {
  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const parts = (['firstName', 'lastName'] as const)
    .map((k) => identity[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return parts.length > 0 ? parts.join(' ') : null;
}

function extractIdentityRole(cvData: CvData): string | null {
  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const role = identity['role'];
  return typeof role === 'string' && role.trim().length > 0 ? role : null;
}
