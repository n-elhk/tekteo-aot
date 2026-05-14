import type { ExperienceLevelValue } from '@org/schemas';

export type ExperienceLevel = ExperienceLevelValue;
export type RemunerationType = 'freelance' | 'cdi' | 'les_deux';

export type { JobProfile, JobProfileStatus } from '@org/types';

/** Réponse de la génération IA en batch. */
export interface GenerateJobProfilesResult {
  readonly results: ReadonlyArray<{
    readonly profileId: string;
    readonly success: boolean;
    readonly error?: string;
  }>;
  readonly modelUsed?: string;
}
