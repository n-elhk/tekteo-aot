import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type {
  CvGenerationStatusValue,
  CvTemplateValue,
  GeneratedCvDto,
} from '../../core/consultant-cvs/consultant-cv.model';

interface StatusBadge {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const STATUS_BADGES: Record<CvGenerationStatusValue, StatusBadge> = {
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  processing: { label: 'En cours', color: '#92400E', bg: '#FEF3C7' },
  success: { label: 'Généré', color: '#065F46', bg: '#D1FAE5' },
  failed: { label: 'Échec', color: '#991B1B', bg: '#FEE2E2' },
};

const TEMPLATE_LABELS: Record<CvTemplateValue, string> = {
  tekteo: 'Tekteo',
  anonyme: 'Anonyme',
};

@Component({
  selector: 'app-generated-cv-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './generated-cv-list.html',
})
export class GeneratedCvList {
  readonly cvs = input.required<ReadonlyArray<GeneratedCvDto>>();
  readonly canEdit = input(false);

  readonly download = output<GeneratedCvDto>();
  readonly regenerate = output<GeneratedCvDto>();
  readonly remove = output<GeneratedCvDto>();

  protected statusBadge(status: CvGenerationStatusValue): StatusBadge {
    return STATUS_BADGES[status];
  }

  protected templateLabel(template: CvTemplateValue): string {
    return TEMPLATE_LABELS[template];
  }
}
