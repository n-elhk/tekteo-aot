import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
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
import {
  SectionTemplate,
  SectionTemplatesService,
} from '../../../core/section-templates/section-templates.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { ModalShell } from '../../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../../shared/ui/button/button';

interface Model {
  name: string;
  promptTemplate: string;
  defaultContent: string;
  orderIndex: number;
}

export interface TemplateEditDialogData {
  /** Si non nul, mode édition. Sinon, création. */
  readonly template: SectionTemplate | null;
  readonly nextOrderIndex: number;
}

/** Dialogue de création / édition d'un modèle de section. */
@Component({
  selector: 'app-template-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button, FormRoot, FormField],
  template: `
    <app-modal-shell
      [title]="data.template ? 'Modifier le modèle' : 'Nouveau modèle de section'"
      [subtitle]="data.template?.name ?? null"
    >
      <form
        [formRoot]="templateForm"
        (submit)="onSubmit()"
        novalidate
        class="space-y-4"
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Nom *</span>
          <input
            type="text"
            [formField]="templateForm.name"
            class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="Ex. Méthodologie agile"
          />
          @if (templateForm.name().touched() && templateForm.name().errors().length > 0) {
            <span class="text-xs font-medium text-red-600">
              {{ templateForm.name().errors()[0].message }}
            </span>
          }
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Prompt *</span>
          <textarea
            rows="8"
            [formField]="templateForm.promptTemplate"
            class="block w-full resize-y rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 font-mono text-sm shadow-inner focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="Instructions détaillées pour l'IA..."
          ></textarea>
          @if (templateForm.promptTemplate().touched() && templateForm.promptTemplate().errors().length > 0) {
            <span class="text-xs font-medium text-red-600">
              {{ templateForm.promptTemplate().errors()[0].message }}
            </span>
          }
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Contenu par défaut</span>
          <textarea
            rows="4"
            [formField]="templateForm.defaultContent"
            class="block w-full resize-y rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="(optionnel)"
          ></textarea>
        </label>
      </form>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="templateForm().submitting()"
          (click)="onSubmit()"
        >
          {{ data.template ? 'Enregistrer' : 'Créer le modèle' }}
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class TemplateEditDialog {
  protected readonly data = inject<TemplateEditDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<SectionTemplate | null, TemplateEditDialog>);
  private readonly service = inject(SectionTemplatesService);
  private readonly toaster = inject(ToastService);

  protected readonly model = signal<Model>(buildInitial(this.data));
  protected readonly templateForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Le nom est requis' });
      minLength(path.name, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.name, 200, { message: 'Au maximum 200 caractères' });
      validate(path.name, ({ value }) =>
        value().length > 0 && value().trim().length === 0
          ? { kind: 'blank', message: 'Ne peut contenir que des espaces' }
          : undefined,
      );
      required(path.promptTemplate, { message: 'Le prompt est requis' });
      minLength(path.promptTemplate, 10, { message: 'Au moins 10 caractères' });
      maxLength(path.promptTemplate, 8000, { message: 'Au maximum 8 000 caractères' });
      maxLength(path.defaultContent, 8000, { message: 'Au maximum 8 000 caractères' });
    },
    {
      submission: {
        action: async () => {
          const m = this.model();
          const dto = {
            name: m.name.trim(),
            promptTemplate: m.promptTemplate,
            defaultContent: m.defaultContent || undefined,
            orderIndex: m.orderIndex,
          };
          try {
            const saved = await firstValueFrom(
              this.data.template
                ? this.service.update(this.data.template.id, dto)
                : this.service.create(dto),
            );
            this.toaster.success({
              title: this.data.template ? 'Modèle mis à jour' : 'Modèle créé',
            });
            this.dialogRef.close(saved);
            return undefined;
          } catch {
            this.toaster.error({
              title: 'Action impossible',
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
    () => this.templateForm().valid() && !this.templateForm().submitting(),
  );

  constructor() {
    // Si la config change après ouverture (peu probable mais propre), resync.
    effect(() => {
      const template = this.data.template;
      untracked(() => {
        if (template) {
          this.model.set({
            name: template.name,
            promptTemplate: template.promptTemplate,
            defaultContent: template.defaultContent ?? '',
            orderIndex: template.orderIndex,
          });
        }
      });
    });
  }

  protected onSubmit(): void {
    void submit(this.templateForm);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}

function buildInitial(data: TemplateEditDialogData): Model {
  if (data.template) {
    return {
      name: data.template.name,
      promptTemplate: data.template.promptTemplate,
      defaultContent: data.template.defaultContent ?? '',
      orderIndex: data.template.orderIndex,
    };
  }
  return {
    name: '',
    promptTemplate: '',
    defaultContent: '',
    orderIndex: data.nextOrderIndex,
  };
}
