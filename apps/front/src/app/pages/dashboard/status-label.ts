import type { ProjectStatus } from '@org/types';

interface StatusLabel {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const LABELS: Record<ProjectStatus, StatusLabel> = {
  brouillon: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  en_cours: { label: 'En cours', color: '#D97706', bg: '#FEF3C7' },
  finalise: { label: 'Finalisé', color: '#059669', bg: '#D1FAE5' },
  soumis: { label: 'Soumis', color: '#2E86AB', bg: '#DBEAFE' },
};

export function statusLabel(status: ProjectStatus): StatusLabel {
  return LABELS[status];
}
