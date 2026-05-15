import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
  CvData,
} from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { FORMAT_SYSTEM_PROMPT, buildFormatPrompt } from './cv-prompts';

@Injectable()
export class ConsultantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
  ) {}

  async findAll(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.consultant.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          createdBy: { select: { id: true, email: true, fullName: true } },
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.consultant.count(),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        variants: {
          orderBy: { createdAt: 'desc' },
          include: {
            jobProfile: { select: { id: true, title: true, projectId: true } },
            generatedCvs: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, status: true, updatedAt: true, filename: true },
            },
          },
        },
      },
    });
    if (!consultant) throw new NotFoundException(`Consultant ${id} introuvable`);
    return consultant;
  }

  create(userId: string, dto: CreateConsultantDto) {
    return this.prisma.consultant
      .create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone ?? null,
          role: dto.role ?? null,
          yearsExperience: dto.yearsExperience ?? null,
          location: dto.location ?? null,
          masterCvData: dto.masterCvData as Prisma.InputJsonValue,
          createdById: userId,
        },
      })
      .catch(this.handleUniqueEmail);
  }

  async update(id: string, dto: UpdateConsultantDto) {
    await this.findOne(id);
    return this.prisma.consultant
      .update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.masterCvData !== undefined && {
            masterCvData: dto.masterCvData as Prisma.InputJsonValue,
          }),
        },
      })
      .catch(this.handleUniqueEmail);
  }

  async remove(id: string) {
    await this.findOne(id);
    // CASCADE Prisma supprime variants + generatedCvs. La purge storage
    // est effectuée en amont par CvVariantsService.removeForConsultant.
    return this.prisma.consultant.delete({ where: { id } });
  }

  // ---------------- Import depuis texte ----------------

  async importFromText(userId: string, dto: ImportConsultantFromTextDto) {
    const generation = await this.anthropic.generate({
      systemPrompt: FORMAT_SYSTEM_PROMPT,
      userMessage: buildFormatPrompt(dto.cvText),
      maxTokens: 8192,
    });

    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed = generation.usage.inputTokens + generation.usage.outputTokens;

    await this.history.record({
      module: 'cv',
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: JSON.stringify(cvData).slice(0, 4000),
      inputData: { mode: 'import-text', textLength: dto.cvText.length },
    });

    if (!dto.persist) {
      return {
        consultant: null,
        cvData,
        usage: { tokensUsed, modelUsed: generation.modelUsed },
      };
    }

    const identity = (cvData.identity ?? {}) as Record<string, unknown>;
    const firstName = stringOr(identity.firstName, 'Inconnu');
    const lastName = stringOr(identity.lastName, 'Inconnu');
    const email = stringOr(identity.email, null);
    if (!email) {
      throw new ConflictException(
        "Aucune adresse email n'a pu être extraite du CV — création impossible.",
      );
    }

    const consultant = await this.prisma.consultant
      .create({
        data: {
          firstName,
          lastName,
          email,
          phone: stringOr(identity.phone, null),
          role: stringOr(identity.role, null),
          location: stringOr(identity.location, null),
          masterCvData: cvData as unknown as Prisma.InputJsonValue,
          createdById: userId,
        },
      })
      .catch(this.handleUniqueEmail);

    return {
      consultant,
      usage: { tokensUsed, modelUsed: generation.modelUsed },
    };
  }

  private handleUniqueEmail = (err: unknown): never => {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      Array.isArray(err.meta?.target) &&
      (err.meta?.target as string[]).includes('email')
    ) {
      throw new ConflictException('Un consultant avec cet email existe déjà');
    }
    throw err;
  };
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
