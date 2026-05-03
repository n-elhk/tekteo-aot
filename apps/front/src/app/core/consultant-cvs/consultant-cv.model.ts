import type { CvData } from '@org/schemas';

export type { CvData };
export type {
  CreateConsultantCvDto,
  UpdateConsultantCvDto,
  FormatCvFromTextDto,
  AdaptCvToJobDto,
  CvImportJobDto,
  CvImportTemplateValue,
  CvImportStatusValue,
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

/** CV consultant tel que renvoyé par l'API. */
export interface ConsultantCv {
  readonly id: string;
  readonly cvData: CvData;
  readonly consultantName: string | null;
  readonly consultantTitle: string | null;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy?: { id: string; email: string; fullName: string | null } | null;
  readonly _count?: { jobProfiles: number };
  readonly jobProfiles?: ReadonlyArray<{ id: string; title: string; projectId: string | null }>;
}

/** Réponse de `POST /consultant-cvs/format-from-text` ou `/:id/adapt-to-job`. */
export interface FormatCvResponse {
  readonly cv?: ConsultantCv | null;
  readonly cvData?: CvData;
  readonly usage: { tokensUsed: number; modelUsed: string };
}

/** Réponse de `POST /consultant-cvs/import-from-file`. */
export interface CvImportCreatedResponse {
  readonly jobId: string;
  readonly status: 'pending' | 'processing' | 'done' | 'failed';
}
