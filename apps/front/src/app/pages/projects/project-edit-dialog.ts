import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { Project } from '@org/types';
import type { ProjectStatusValue } from '@org/schemas';
import { ProjectsService } from '../../core/projects/projects.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';

interface ProjectEditModel {
  name: string;
  clientName: string;
  marketReference: string;
  marketObject: string;
  deadline: string;
  durationMonths: string;
  status: ProjectStatusValue;
}

export interface ProjectEditDialogData {
  readonly project: Project;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ProjectStatusValue; label: string }> = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'finalise', label: 'Finalisé' },
  { value: 'soumis', label: 'Soumis' },
];

@Component({
  selector: 'app-project-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button, FormRoot, FormField],
  template: `
    <app-modal-shell title="Modifier le projet" [subtitle]="data.project.name">
      <form [formRoot]="projectForm" (submit)="onSubmit()" novalidate class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-medium text-surface-900">Nom du projet *</span>
            <input
              type="text"
              [formField]="projectForm.name"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
            @if (projectForm.name().touched() && projectForm.name().errors().length > 0) {
              <span class="text-xs font-medium text-red-600">{{ projectForm.name().errors()[0].message }}</span>
            }
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Client *</span>
            <input
              type="text"
              [formField]="projectForm.clientName"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
            @if (projectForm.clientName().touched() && projectForm.clientName().errors().length > 0) {
              <span class="text-xs font-medium text-red-600">{{ projectForm.clientName().errors()[0].message }}</span>
            }
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Référence du marché</span>
            <input
              type="text"
              [formField]="projectForm.marketReference"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Date limite</span>
            <input
              type="date"
              [formField]="projectForm.deadline"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Durée (mois)</span>
            <input
              type="number"
              inputmode="numeric"
              [formField]="projectForm.durationMonths"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Statut</span>
            <select
              [formField]="projectForm.status"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            >
              @for (opt of statusOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </label>

          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-medium text-surface-900">Objet du marché</span>
            <textarea
              rows="3"
              [formField]="projectForm.marketObject"
              class="block w-full resize-y rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            ></textarea>
          </label>
        </div>
      </form>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="projectForm().submitting()"
          (click)="onSubmit()"
        >
          Enregistrer
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class ProjectEditDialog {
  protected readonly data = inject<ProjectEditDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<Project | null, ProjectEditDialog>);
  private readonly projectsService = inject(ProjectsService);
  private readonly toaster = inject(ToastService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly model = signal<ProjectEditModel>(buildModel(this.data.project));

  protected readonly projectForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Le nom du projet est requis' });
      minLength(path.name, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.name, 200, { message: 'Au maximum 200 caractères' });
      required(path.clientName, { message: 'Le client est requis' });
      minLength(path.clientName, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.clientName, 200, { message: 'Au maximum 200 caractères' });
      maxLength(path.marketReference, 100, { message: 'Au maximum 100 caractères' });
      maxLength(path.marketObject, 2000, { message: 'Au maximum 2 000 caractères' });
    },
    {
      submission: {
        action: async () => {
          const m = this.model();
          const duration = parseInt(m.durationMonths, 10);
          const dto = {
            name: m.name.trim(),
            clientName: m.clientName.trim(),
            status: m.status,
            ...(m.marketReference.trim() ? { marketReference: m.marketReference.trim() } : { marketReference: undefined }),
            ...(m.marketObject.trim() ? { marketObject: m.marketObject.trim() } : {}),
            ...(m.deadline ? { deadline: m.deadline } : { deadline: undefined }),
            ...(Number.isFinite(duration) && duration > 0 ? { durationMonths: duration } : { durationMonths: undefined }),
          };
          try {
            const updated = await firstValueFrom(
              this.projectsService.update(this.data.project.id, dto),
            );
            this.toaster.success({ title: 'Projet mis à jour' });
            this.dialogRef.close(updated);
            return undefined;
          } catch {
            this.toaster.error({
              title: 'Mise à jour impossible',
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
    () => this.projectForm().valid() && !this.projectForm().submitting(),
  );

  protected onSubmit(): void {
    void submit(this.projectForm);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}

function buildModel(project: Project): ProjectEditModel {
  return {
    name: project.name,
    clientName: project.clientName,
    marketReference: project.marketReference ?? '',
    marketObject: project.marketObject ?? '',
    deadline: project.deadline ? project.deadline.slice(0, 10) : '',
    durationMonths: project.durationMonths?.toString() ?? '',
    status: project.status as ProjectStatusValue,
  };
}
