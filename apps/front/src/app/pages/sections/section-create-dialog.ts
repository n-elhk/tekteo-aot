import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { Section } from '@org/types';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';
import { SectionsService } from '../../core/sections/sections.service';
import { ToastService } from '../../core/notifications/toast.service';

interface Model {
  title: string;
}

export interface SectionCreateDialogData {
  readonly projectId: string;
  readonly nextOrderIndex: number;
}

/**
 * Dialogue de création d'une section. Renvoie la section créée à la fermeture
 * (ou `null` si annulation).
 */
@Component({
  selector: 'app-section-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button, FormRoot, FormField],
  template: `
    <app-modal-shell
      title="Nouvelle section"
      subtitle="Donnez un titre clair à la section. Vous pourrez l'éditer ensuite."
    >
      <form
        [formRoot]="sectionForm"
        (submit)="onSubmit()"
        novalidate
        class="space-y-4"
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Titre de la section *</span>
          <input
            type="text"
            [formField]="sectionForm.title"
            class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="Ex. Méthodologie de réponse"
          />
          @if (sectionForm.title().touched() && sectionForm.title().errors().length > 0) {
            <span class="text-xs font-medium text-red-600">
              {{ sectionForm.title().errors()[0].message }}
            </span>
          }
        </label>
      </form>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="sectionForm().submitting()"
          (click)="onSubmit()"
        >
          Créer la section
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class SectionCreateDialog {
  private readonly data = inject<SectionCreateDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<Section | null, SectionCreateDialog>);
  private readonly sectionsService = inject(SectionsService);
  private readonly toaster = inject(ToastService);

  protected readonly model = signal<Model>({ title: '' });
  protected readonly sectionForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Le titre est requis' });
      minLength(path.title, 1, { message: 'Au moins un caractère' });
      maxLength(path.title, 200, { message: 'Au maximum 200 caractères' });
      validate(path.title, ({ value }) =>
        value().length > 0 && value().trim().length === 0
          ? { kind: 'blank', message: 'Ne peut contenir que des espaces' }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          try {
            const section = await firstValueFrom(
              this.sectionsService.create(this.data.projectId, {
                title: this.model().title.trim(),
                content: '',
                orderIndex: this.data.nextOrderIndex,
                status: 'brouillon',
              }),
            );
            this.toaster.success({ title: 'Section créée' });
            this.dialogRef.close(section);
            return undefined;
          } catch {
            this.toaster.error({
              title: 'Création impossible',
              description: 'Veuillez réessayer dans un instant.',
            });
            return undefined;
          }
        },
        onInvalid: (field) => {
          field().markAsTouched();
        },
      },
    },
  );
  protected readonly canSubmit = computed(
    () => this.sectionForm().valid() && !this.sectionForm().submitting(),
  );

  protected onSubmit(): void {
    void submit(this.sectionForm);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
