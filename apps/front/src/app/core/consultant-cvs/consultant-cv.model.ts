import type {
  CvData,
  CvJobEventDto,
  CvGenerationStatusValue,
  CvTemplateValue,
  GeneratedCvDto,
} from '@org/schemas';

export type {
  CvData,
  CvJobEventDto,
  CvGenerationStatusValue,
  CvTemplateValue,
  GeneratedCvDto,
};
export type {
  CreateConsultantCvDto,
  UpdateConsultantCvDto,
  FormatCvFromTextDto,
  AdaptCvToJobDto,
  CvImportJobDto,
  CvImportTemplateValue,
  CvImportStatusValue,
  GenerateCvFromTemplateDto,
} from '@org/schemas';

/** Identité simplifiée souvent rencontrée dans `cvData.identity`. */
export interface CvIdentity {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly role?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly location?: string;
  readonly summary?: string;
  readonly [key: string]: unknown;
}

/** Métadonnées du dernier CV généré (utilisé dans la liste). */
export interface LatestGeneratedCv {
  readonly id: string;
  readonly template: CvTemplateValue;
  readonly status: CvGenerationStatusValue;
  readonly updatedAt: string;
}

/** Profil consultant tel que renvoyé par l'API. */
export interface ConsultantCv {
  readonly id: string;
  readonly cvData: CvData;
  readonly consultantName: string | null;
  readonly consultantTitle: string | null;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  readonly _count?: { jobProfiles: number };
  readonly jobProfiles?: ReadonlyArray<{
    id: string;
    title: string;
    projectId: string | null;
  }>;
  readonly latestGeneratedCv?: LatestGeneratedCv | null;
  readonly generatedCvs?: ReadonlyArray<GeneratedCvDto>;
}

/** Page paginée de la liste consultants. */
export interface ConsultantCvsPage {
  readonly items: ConsultantCv[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Réponse de POST /import-from-file (multi). */
export interface CvImportBulkResponse {
  readonly jobs: ReadonlyArray<{
    jobId: string;
    status: 'pending' | 'processing' | 'done' | 'failed';
  }>;
}

/** Réponse de POST /:id/generate. */
export interface CvGenerationResponse {
  readonly jobId: string;
  readonly status: 'pending' | 'processing' | 'done' | 'failed';
}

/** Réponse de `POST /consultant-cvs/format-from-text` (legacy). */
export interface FormatCvResponse {
  readonly cv?: ConsultantCv | null;
  readonly cvData?: CvData;
  readonly usage: { tokensUsed: number; modelUsed: string };
}
