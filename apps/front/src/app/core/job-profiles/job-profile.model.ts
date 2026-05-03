import type { SectionStatus } from '@org/types';
import type {
  ExperienceLevelValue,
  CreateJobProfileDto,
} from '@org/schemas';

export type ExperienceLevel = ExperienceLevelValue;
export type RemunerationType = 'freelance' | 'cdi' | 'les_deux';

/**
 * Représentation front d'une fiche de poste, telle que renvoyée par
 * l'API NestJS (modèle Prisma `JobProfile`).
 *
 * On reprend la base du DTO de création et on étend avec les champs
 * réellement persistés.
 */
export interface JobProfile extends CreateJobProfileDto {
  readonly id: string;
  readonly projectId: string | null;
  readonly status: SectionStatus;
  readonly generatedContent: string;
  readonly consultantName: string | null;
  readonly consultantTitle: string | null;
  readonly consultantYearsExp: number | null;
  readonly consultantSummary: string | null;
  readonly cvId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Réponse de la génération IA en batch. */
export interface GenerateJobProfilesResult {
  readonly results: ReadonlyArray<{
    readonly profileId: string;
    readonly success: boolean;
    readonly error?: string;
  }>;
  readonly modelUsed?: string;
}
