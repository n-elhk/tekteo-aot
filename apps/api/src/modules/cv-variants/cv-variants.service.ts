import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  CreateCvVariantDto,
  CvData,
  CvTemplateValue,
  UpdateCvVariantDto,
} from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import {
  ADAPT_SYSTEM_PROMPT,
  buildAdaptPrompt,
  type JobProfilePayload,
} from '../consultants/cv-prompts';

@Injectable()
export class CvVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
  ) {}

  async findOne(id: string) {
    const variant = await this.prisma.cvVariant.findUnique({
      where: { id },
      include: {
        consultant: true,
        jobProfile: { select: { id: true, title: true, projectId: true } },
        generatedCvs: {
          orderBy: { updatedAt: 'desc' },
          select: { id: true, status: true, filename: true, updatedAt: true },
        },
      },
    });
    if (!variant) throw new NotFoundException(`Variante ${id} introuvable`);
    return variant;
  }

  async create(consultantId: string, userId: string, dto: CreateCvVariantDto) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id: consultantId },
    });
    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} introuvable`);
    }
    const jobProfile = await this.prisma.jobProfile.findUnique({
      where: { id: dto.jobProfileId },
    });
    if (!jobProfile) {
      throw new NotFoundException(`Fiche de poste ${dto.jobProfileId} introuvable`);
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
      userMessage: buildAdaptPrompt(
        consultant.masterCvData as unknown as CvData,
        payload,
      ),
      maxTokens: 16_000,
    });
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed = generation.usage.inputTokens + generation.usage.outputTokens;

    const name = dto.name ?? buildAutoName(jobProfile.title, dto.template);

    const variant = await this.prisma.cvVariant.create({
      data: {
        consultantId,
        jobProfileId: jobProfile.id,
        template: dto.template,
        name,
        cvData: cvData as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await this.history.record({
      module: 'cv',
      projectId: jobProfile.projectId ?? undefined,
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Variante créée depuis consultant ${consultantId} vers fiche ${jobProfile.title}`,
      inputData: {
        mode: 'create-variant',
        consultantId,
        jobProfileId: jobProfile.id,
        template: dto.template,
        variantId: variant.id,
      },
    });

    return { variant, usage: { tokensUsed, modelUsed: generation.modelUsed } };
  }

  async update(id: string, dto: UpdateCvVariantDto) {
    await this.findOne(id);
    return this.prisma.cvVariant.update({
      where: { id },
      data: {
        ...(dto.cvData !== undefined && {
          cvData: dto.cvData as Prisma.InputJsonValue,
        }),
        ...(dto.name !== undefined && { name: dto.name }),
      },
    });
  }

  async regenerate(id: string, userId: string) {
    const variant = await this.findOne(id);
    // findOne renvoie un jobProfile partiel — on relit le job complet pour le prompt
    const fullJob = await this.prisma.jobProfile.findUniqueOrThrow({
      where: { id: variant.jobProfileId },
    });

    const payload: JobProfilePayload = {
      title: fullJob.title,
      experienceLevel: fullJob.experienceLevel,
      requiredSkills: fullJob.requiredSkills,
      optionalSkills: fullJob.optionalSkills,
      missions: fullJob.missions,
      education: fullJob.education,
    };

    const generation = await this.anthropic.generate({
      systemPrompt: ADAPT_SYSTEM_PROMPT,
      userMessage: buildAdaptPrompt(
        variant.consultant.masterCvData as unknown as CvData,
        payload,
      ),
      maxTokens: 16_000,
    });
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed = generation.usage.inputTokens + generation.usage.outputTokens;

    const updated = await this.prisma.cvVariant.update({
      where: { id },
      data: { cvData: cvData as unknown as Prisma.InputJsonValue },
    });

    await this.history.record({
      module: 'cv',
      projectId: fullJob.projectId ?? undefined,
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Variante ${id} régénérée`,
      inputData: { mode: 'regenerate-variant', variantId: id },
    });

    return { variant: updated, usage: { tokensUsed, modelUsed: generation.modelUsed } };
  }

  remove(id: string) {
    // La purge des fichiers PDF est faite par GeneratedCvsService avant cascade.
    return this.prisma.cvVariant.delete({ where: { id } });
  }

  listForConsultant(consultantId: string) {
    return this.prisma.cvVariant.findMany({
      where: { consultantId },
      orderBy: { createdAt: 'desc' },
      include: {
        jobProfile: { select: { id: true, title: true, projectId: true } },
        generatedCvs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, filename: true, updatedAt: true },
        },
      },
    });
  }
}

function buildAutoName(jobTitle: string, template: CvTemplateValue): string {
  const label = template === 'tekteo' ? 'Tekteo' : 'Anonyme';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${jobTitle} — ${label} — ${stamp}`;
}
