import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { CvTemplateValue } from '../../core/consultant-cvs/consultant-cv.model';
import { Button } from '../../shared/ui/button/button';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';

interface TemplateOption {
  readonly value: CvTemplateValue;
  readonly label: string;
  readonly description: string;
}

const TEMPLATE_OPTIONS: ReadonlyArray<TemplateOption> = [
  {
    value: 'tekteo',
    label: 'Tekteo',
    description: 'Mise en page complète avec identité Tekteo.',
  },
  {
    value: 'anonyme',
    label: 'Anonyme',
    description: 'CV anonymisé pour transmission externe.',
  },
];

/**
 * Mini-modale de choix de template pour la génération d'un CV.
 * Renvoie le `CvTemplateValue` choisi en `closed` (ou `null` si annulé).
 */
@Component({
  selector: 'app-generate-cv-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button],
  template: `
    <app-modal-shell title="Générer un nouveau CV">
      <p class="text-sm text-surface-900/60 mb-4">
        Choisissez le template à utiliser pour la génération.
      </p>
      <div class="space-y-2">
        @for (option of templates; track option.value) {
          <label
            class="flex items-start gap-3 rounded-xl border border-surface-200 p-3 cursor-pointer transition hover:border-brand-300"
            [class.border-brand-500]="selected() === option.value"
            [class.bg-brand-50]="selected() === option.value"
          >
            <input
              type="radio"
              name="template"
              [value]="option.value"
              [checked]="selected() === option.value"
              (change)="selected.set(option.value)"
              class="mt-0.5"
            />
            <div>
              <p class="text-sm font-semibold text-surface-900">
                {{ option.label }}
              </p>
              <p class="text-xs text-surface-900/60">
                {{ option.description }}
              </p>
            </div>
          </label>
        }
      </div>

      <div modalFooter class="flex items-center justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button variant="primary" (click)="confirm()">
          Générer
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class GenerateCvDialog {
  private readonly ref = inject<DialogRef<CvTemplateValue | null>>(DialogRef);

  protected readonly templates = TEMPLATE_OPTIONS;
  protected readonly selected = signal<CvTemplateValue>('tekteo');

  protected confirm(): void {
    this.ref.close(this.selected());
  }

  protected cancel(): void {
    this.ref.close(null);
  }
}
