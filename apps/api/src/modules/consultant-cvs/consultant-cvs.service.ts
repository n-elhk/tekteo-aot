import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  AdaptCvToJobDto,
  CreateConsultantCvDto,
  CvData,
  FormatCvFromTextDto,
  UpdateConsultantCvDto,
} from '@org/schemas';
import { CvWorkerService } from '../../common/cv-worker/cv-worker.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';

@Injectable()
export class ConsultantCvsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: CvWorkerService,
    private readonly history: GenerationHistoryService,
  ) {}

  // --------------------------------------------------------
  // CRUD
  // --------------------------------------------------------
  findAll() {
    return this.prisma.consultantCv.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        _count: { select: { jobProfiles: true } },
      },
    });
  }

  async findOne(id: string) {
    const cv = await this.prisma.consultantCv.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        jobProfiles: {
          select: { id: true, title: true, projectId: true },
        },
      },
    });
    if (!cv) throw new NotFoundException(`CV ${id} introuvable`);
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
    return this.prisma.consultantCv.delete({ where: { id } });
  }

  // --------------------------------------------------------
  // Génération IA — extraction depuis texte brut (worker LLM local)
  // --------------------------------------------------------
  async formatFromText(userId: string, dto: FormatCvFromTextDto) {
    const result = await this.worker.processFromText(dto.cvText);

    await this.history.record({
      module: 'cv',
      userId,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
      outputContent: JSON.stringify(result.cvData).slice(0, 4000),
      inputData: { mode: 'format', textLength: dto.cvText.length },
    });

    if (dto.persist) {
      const persisted = await this.prisma.consultantCv.create({
        data: {
          cvData: result.cvData as unknown as Prisma.InputJsonValue,
          consultantName: extractIdentityName(result.cvData),
          consultantTitle: extractIdentityRole(result.cvData),
          createdById: userId,
        },
      });
      return {
        cv: persisted,
        usage: { tokensUsed: result.tokensUsed, modelUsed: result.modelUsed },
      };
    }

    return {
      cv: null,
      cvData: result.cvData,
      usage: { tokensUsed: result.tokensUsed, modelUsed: result.modelUsed },
    };
  }

  // --------------------------------------------------------
  // Adaptation à une fiche de poste (worker LLM local)
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

    const result = await this.worker.adaptToJob(sourceCv.cvData, {
      title: jobProfile.title,
      experienceLevel: jobProfile.experienceLevel,
      requiredSkills: jobProfile.requiredSkills,
      optionalSkills: jobProfile.optionalSkills,
      missions: jobProfile.missions,
      education: jobProfile.education,
    });

    const adaptedCv = await this.prisma.consultantCv.create({
      data: {
        cvData: result.cvData as unknown as Prisma.InputJsonValue,
        consultantName:
          extractIdentityName(result.cvData) ?? sourceCv.consultantName,
        consultantTitle:
          extractIdentityRole(result.cvData) ?? jobProfile.title,
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
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
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
      usage: { tokensUsed: result.tokensUsed, modelUsed: result.modelUsed },
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
