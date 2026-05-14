import type { CreateJobProfileDto } from '@org/schemas';

// ============================================================
// Auth types
// ============================================================

export type Role = 'admin' | 'redacteur' | 'lecteur';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
}

// ============================================================
// Project types
// ============================================================

export type ProjectStatus =
  | 'brouillon'
  | 'en_cours'
  | 'finalise'
  | 'soumis';

export interface Project {
  id: string;
  name: string;
  clientName: string;
  marketReference: string | null;
  marketObject: string | null;
  deadline: string | null;
  technologies: string[];
  durationMonths: number | null;
  lots: string[];
  status: ProjectStatus;
  sourceAoId: string | null;
  createdBy: { id: string; email: string; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BpuLine {
  id: string;
  projectId: string;
  profileTitle: string;
  experienceLevel: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  lineType: 'bpu' | 'dpgf';
  phase: string | null;
  orderIndex: number;
  createdAt: string;
}

export type DocumentCategory = 'dce' | 'offre' | 'candidature';

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  category: DocumentCategory;
  storagePath: string;
  fileSize: number | null;
  uploadedById: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; email: string; fullName: string | null } | null;
}

export type JobProfileStatus = 'brouillon' | 'valide';

export interface JobProfile extends CreateJobProfileDto {
  id: string;
  projectId: string | null;
  status: JobProfileStatus;
  generatedContent: string | null;
  consultantName: string | null;
  consultantTitle: string | null;
  consultantYearsExp: number | null;
  consultantSummary: string | null;
  cvId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  sections: { id: string }[];
  jobProfiles: { id: string }[];
  documents: { id: string }[];
  bpuLines: { id: string }[];
}

// ============================================================
// Section types
// ============================================================

export type SectionStatus = 'brouillon' | 'valide';

export interface Section {
  id: string;
  projectId: string;
  templateId: string | null;
  title: string;
  content: string;
  orderIndex: number;
  status: SectionStatus;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string } | null;
}

// ============================================================
// Dashboard types
// ============================================================

export interface DashboardOverview {
  projectStats: {
    total: number;
    byStatus: {
      brouillon: number;
      en_cours: number;
      finalise: number;
      soumis: number;
    };
  };
  tokenStats: {
    totalTokens: number;
    totalCost: number;
    byModule: Array<{
      module:
        | 'section'
        | 'fiche_poste'
        | 'bpu'
        | 'infographie'
        | 'cv'
        | 'ao_analyse';
      count: number;
      tokens: number;
    }>;
  };
  recentProjects: Array<{
    id: string;
    name: string;
    clientName: string;
    deadline: string | null;
    status: 'brouillon' | 'en_cours' | 'finalise' | 'soumis';
    updatedAt: string;
  }>;
}
// Pagination
// ============================================================

/** Query params standards pour les endpoints paginés. */
export interface PaginationQuery {
  page: number;
  pageSize: number;
}

/** Forme de réponse standard pour les endpoints de liste paginés. */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Valeur par défaut prête à passer dans `rxResource({ defaultValue: EMPTY_PAGINATED_RESPONSE })`
 * pour les ressources paginées (page absente / non encore chargée).
 *
 * Typée `PaginatedResponse<never>` : assignable à tout `PaginatedResponse<T>`
 * grâce à la covariance de `ReadonlyArray`.
 */
export const EMPTY_PAGINATED_RESPONSE: PaginatedResponse<never> = {
  items: [],
  total: 0,
  page: 0,
  pageSize: 20,
};
