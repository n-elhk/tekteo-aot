import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JobProfile, RemunerationType } from '../../generated/prisma/client';
import type {
  CreateJobProfileDto,
  GenerateJobProfilesDto,
  UpdateJobProfileDto,
} from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';

const PROFILE_SYSTEM_PROMPT = `Tu es un expert RH spécialisé dans les appels d'offres publics IT en France. Tu rédiges des fiches de poste pour TEKTEO, une ESN parisienne.

Le document Word généré intègre déjà automatiquement : intitulé du poste, niveau d'expérience, localisation et formation.
Ne répète PAS ces informations. Rédige uniquement les sections suivantes :

## Contexte de la mission
## Missions & responsabilités
## Compétences techniques requises
## Compétences fonctionnelles
## Profil recherché
## Savoir-être / Soft skills

Règles :
- Français professionnel, ton assertif et concret
- Missions : liste à puces détaillée (8-12 points)
- Compétences techniques : distingue "Maîtrise indispensable" (### sous-titre) et "Appréciées" (### sous-titre)
- Profil recherché : années d'expérience, secteur, certifications éventuelles
- Soft skills : 4-6 points comportementaux adaptés au contexte marché public
- Longueur totale : 400-600 mots`;

const META_SUFFIX = `

---
À la toute fin de ta réponse, ajoute OBLIGATOIREMENT ces deux lignes (sans texte autour) :
QUANTITE:[N] — le nombre de consultants estimé pour ce poste selon la durée et la charge de la mission (entier ≥ 1)
REMUNERATION:[type] — parmi : freelance, cdi, les_deux`;

const BATCH_SIZE = 3;

interface ParsedMeta {
  content: string;
  quantityNeeded: number;
  remunerationType: RemunerationType | null;
}

@Injectable()
export class JobProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
  ) {}

  findAll() {
    return this.prisma.jobProfile.findMany({
      orderBy: { title: 'asc' },
      select: { id: true, title: true, projectId: true },
    });
  }

  findAllByProject(projectId: string) {
    return this.prisma.jobProfile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.jobProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException(`Fiche de poste ${id} introuvable`);
    }
    return profile;
  }

  create(projectId: string, dto: CreateJobProfileDto) {
    const { boondmanagerUrl, ...rest } = dto;
    return this.prisma.jobProfile.create({
      data: {
        ...rest,
        projectId,
        boondmanagerUrl: boondmanagerUrl || null,
      },
    });
  }

  async update(id: string, dto: UpdateJobProfileDto) {
    await this.findOne(id);
    const { boondmanagerUrl, ...rest } = dto;
    return this.prisma.jobProfile.update({
      where: { id },
      data: {
        ...rest,
        ...(boondmanagerUrl !== undefined
          ? { boondmanagerUrl: boondmanagerUrl || null }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.jobProfile.delete({ where: { id } });
  }

  // --------------------------------------------------------
  // Génération IA — batch parallélisé
  // --------------------------------------------------------
  async generateBatch(
    projectId: string,
    userId: string,
    dto: GenerateJobProfilesDto,
  ) {
    if (!this.anthropic.isEnabled()) {
      throw new BadRequestException(
        "Service Claude non configuré : ajoutez ANTHROPIC_API_KEY dans l'environnement",
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Projet ${projectId} introuvable`);
    }

    const profiles = await this.prisma.jobProfile.findMany({
      where: {
        id: { in: dto.profileIds },
        projectId,
      },
    });

    if (profiles.length !== dto.profileIds.length) {
      throw new BadRequestException(
        'Certaines fiches sont introuvables ou n\'appartiennent pas à ce projet',
      );
    }

    const projectContext = {
      clientName: project.clientName,
      marketObject: project.marketObject,
      technologies: project.technologies,
    };

    const results: Array<{
      id: string;
      content?: string;
      quantityNeeded?: number;
      remunerationType?: RemunerationType | null;
      tokens?: number;
      error?: string;
    }> = [];

    // Process in batches to avoid hitting rate limits
    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (profile) => {
          try {
            const userMessage = this.buildUserMessage(profile, projectContext);

            const response = await this.anthropic.generate({
              systemPrompt: PROFILE_SYSTEM_PROMPT,
              userMessage,
              model: dto.model,
              maxTokens: 2048,
            });

            const meta = this.parseMeta(response.content);

            // Persist generated content + meta
            await this.prisma.jobProfile.update({
              where: { id: profile.id },
              data: {
                generatedContent: meta.content,
                quantityNeeded: meta.quantityNeeded,
                ...(meta.remunerationType
                  ? { remunerationType: meta.remunerationType }
                  : {}),
              },
            });

            await this.history.record({
              module: 'fiche_poste',
              projectId,
              userId,
              modelUsed: response.modelUsed,
              tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
              outputContent: meta.content,
              inputData: {
                jobProfileId: profile.id,
                title: profile.title,
                level: profile.experienceLevel,
              },
            });

            return {
              id: profile.id,
              content: meta.content,
              quantityNeeded: meta.quantityNeeded,
              remunerationType: meta.remunerationType,
              tokens: response.usage.outputTokens,
            };
          } catch (error) {
            return {
              id: profile.id,
              error: error instanceof Error ? error.message : 'Erreur inconnue',
            };
          }
        }),
      );
      results.push(...batchResults);
    }

    return { results };
  }

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------
  private buildUserMessage(
    profile: JobProfile,
    projectContext: {
      clientName: string;
      marketObject: string | null;
      technologies: string[];
    },
  ): string {
    const lines: string[] = [];

    if (projectContext) {
      lines.push('## Contexte projet');
      lines.push(`Client : ${projectContext.clientName}`);
      lines.push(`Objet : ${projectContext.marketObject ?? 'N/A'}`);
      lines.push(
        `Technologies : ${
          projectContext.technologies.length > 0
            ? projectContext.technologies.join(', ')
            : 'N/A'
        }`,
      );
      lines.push('');
    }

    const hasTjm =
      profile.tjmLow || profile.tjmHigh || profile.tjmRecommended;
    const hasSalary =
      profile.salaryLow || profile.salaryHigh || profile.salaryRecommended;

    let pricingContext = '';
    if (hasTjm || hasSalary) {
      const parts: string[] = ['Rémunération renseignée :'];
      if (hasTjm) {
        parts.push(
          ` TJM ${profile.tjmLow ?? '?'}-${profile.tjmHigh ?? '?'} €/j (recommandé : ${profile.tjmRecommended ?? '?'} €/j)`,
        );
      }
      if (hasSalary) {
        parts.push(
          ` | CDI ${profile.salaryLow ?? '?'}-${profile.salaryHigh ?? '?'} k€/an`,
        );
      }
      pricingContext = parts.join('');
    } else {
      pricingContext =
        'Rémunération : non renseignée — déduis le type (freelance/cdi/les_deux) adapté à ce profil marché public';
    }

    lines.push('## Fiche de poste à rédiger');
    lines.push('');
    lines.push(`Intitulé : ${profile.title}`);
    lines.push(`Niveau : ${profile.experienceLevel}`);
    lines.push(
      `Compétences obligatoires : ${
        profile.requiredSkills.length > 0
          ? profile.requiredSkills.join(', ')
          : 'Non précisées'
      }`,
    );
    lines.push(
      `Compétences souhaitées : ${
        profile.optionalSkills.length > 0
          ? profile.optionalSkills.join(', ')
          : 'Non précisées'
      }`,
    );
    lines.push(`Missions : ${profile.missions || 'Non précisées'}`);
    lines.push(`Formation : ${profile.education || 'Non précisée'}`);
    lines.push(`Localisation : ${profile.location || 'Île-de-France'}`);
    lines.push(`Durée marché : ${profile.duration || 'Non précisée'}`);
    lines.push(
      `Contexte marché : ${profile.marketContext || 'Non précisé'}`,
    );
    lines.push(pricingContext);
    lines.push('');
    lines.push('Rédige la fiche de poste complète selon le format demandé.');
    lines.push(META_SUFFIX);

    return lines.join('\n');
  }

  private parseMeta(raw: string): ParsedMeta {
    const quantityMatch = raw.match(/^QUANTITE:(\d+)\s*$/m);
    const remunerationMatch = raw.match(
      /^REMUNERATION:(freelance|cdi|les_deux)\s*$/m,
    );
    const content = raw
      .replace(/^QUANTITE:\d+\s*$/m, '')
      .replace(/^REMUNERATION:\S+\s*$/m, '')
      .replace(/\n---\s*$/, '')
      .trim();

    return {
      content,
      quantityNeeded: quantityMatch ? parseInt(quantityMatch[1], 10) : 1,
      remunerationType: remunerationMatch
        ? (remunerationMatch[1] as RemunerationType)
        : null,
    };
  }
}
