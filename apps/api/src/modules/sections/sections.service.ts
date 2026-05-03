import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type {
  CreateSectionDto,
  UpdateSectionDto,
} from '@org/schemas';
import {
  AnthropicService,
  type ClaudeAttachment,
} from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { SystemPromptsService } from '../system-prompts/system-prompts.service';

const GLOBAL_PROMPT_NAME = 'prompt_global';

export interface GenerateSectionInput {
  instructions?: string;
  attachments?: ClaudeAttachment[];
  /** If provided, regenerates by adjusting the current content. */
  baseContent?: string;
  /** Optional override of the model. */
  model?: string;
}

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly systemPrompts: SystemPromptsService,
    private readonly history: GenerationHistoryService,
  ) {}

  findAllByProject(projectId: string) {
    return this.prisma.section.findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
      include: { template: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        template: true,
        project: { select: { id: true, name: true, clientName: true } },
      },
    });
    if (!section) {
      throw new NotFoundException(`Section ${id} introuvable`);
    }
    return section;
  }

  create(projectId: string, dto: CreateSectionDto) {
    return this.prisma.section.create({
      data: { ...dto, projectId },
    });
  }

  async update(id: string, dto: UpdateSectionDto) {
    await this.findOne(id);
    return this.prisma.section.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.section.delete({ where: { id } });
  }

  // --------------------------------------------------------
  // Génération IA (Claude)
  // --------------------------------------------------------
  async generate(
    sectionId: string,
    userId: string,
    input: GenerateSectionInput,
  ) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { template: true, project: true },
    });
    if (!section) throw new NotFoundException(`Section ${sectionId} introuvable`);

    if (!this.anthropic.isEnabled()) {
      throw new BadRequestException(
        "Service Claude non configuré : ajoutez ANTHROPIC_API_KEY dans l'environnement",
      );
    }

    const promptConfig = await this.systemPrompts.findByName(GLOBAL_PROMPT_NAME);

    const userMessage = input.baseContent
      ? this.buildAdjustMessage(section, input)
      : this.buildGenerateMessage(section, input);

    const result = await this.anthropic.generate({
      systemPrompt: promptConfig.content,
      userMessage,
      model: input.model ?? promptConfig.model,
      attachments: input.attachments,
      maxTokens: 4096,
    });

    await this.history.record({
      module: 'section',
      projectId: section.projectId,
      userId,
      modelUsed: result.modelUsed,
      tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
      outputContent: result.content,
      inputData: {
        sectionId: section.id,
        sectionTitle: section.title,
        templateName: section.template?.name ?? null,
        instructions: input.instructions ?? null,
        adjust: Boolean(input.baseContent),
        attachmentsCount: input.attachments?.length ?? 0,
      },
    });

    return {
      content: result.content,
      modelUsed: result.modelUsed,
      usage: result.usage,
    };
  }

  // --------------------------------------------------------
  // Builders
  // --------------------------------------------------------
  private buildGenerateMessage(
    section: NonNullable<Awaited<ReturnType<typeof this.prisma.section.findUnique>>> & {
      template: { promptTemplate: string; name: string } | null;
      project: {
        clientName: string;
        marketObject: string | null;
        technologies: string[];
        durationMonths: number | null;
        marketReference: string | null;
      };
    },
    input: GenerateSectionInput,
  ): string {
    const lines: string[] = [];
    const project = section.project;

    lines.push('## Contexte du projet');
    lines.push(`Client : ${project.clientName}`);
    if (project.marketObject) lines.push(`Objet : ${project.marketObject}`);
    if (project.technologies.length > 0) {
      lines.push(`Technologies : ${project.technologies.join(', ')}`);
    }
    if (project.durationMonths) {
      lines.push(`Durée : ${project.durationMonths} mois`);
    }
    if (project.marketReference) {
      lines.push(`Référence : ${project.marketReference}`);
    }
    lines.push('');

    if (section.template?.promptTemplate) {
      lines.push('## Consigne de section');
      lines.push(section.template.promptTemplate);
    } else {
      lines.push('## Section à rédiger');
      lines.push(`Titre : ${section.title}`);
    }
    lines.push('');

    if (input.instructions?.trim()) {
      lines.push('## Instructions supplémentaires');
      lines.push(input.instructions.trim());
    }

    return lines.join('\n');
  }

  private buildAdjustMessage(
    section: { title: string },
    input: GenerateSectionInput,
  ): string {
    const instruction = input.instructions?.trim()
      ? `Instruction de correction : ${input.instructions.trim()}`
      : "Améliore et enrichis ce contenu pour le rendre plus professionnel et adapté aux appels d'offres publics.";

    return [
      `Voici le contenu actuellement rédigé pour la section "${section.title}" :`,
      '',
      input.baseContent ?? '',
      '',
      '---',
      '',
      instruction,
    ].join('\n');
  }
}
