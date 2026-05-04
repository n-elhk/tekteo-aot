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
  createdById: string | null;
  createdBy?: { id: string; email: string; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { sections: number; jobProfiles: number };
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
