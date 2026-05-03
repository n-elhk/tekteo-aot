import { ChangeDetectionStrategy, Component, InjectionToken, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
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
import { JobProfile } from '../../core/job-profiles/job-profile.model';
import type { ExperienceLevel } from '../../core/job-profiles/job-profile.model';
import { JobProfilesService } from '../../core/job-profiles/job-profiles.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';
import { TagInput } from '../../shared/ui/tag-input/tag-input';

interface Model {
  title: string;
  experienceLevel: ExperienceLevel;
  location: string;
}

export interface JobProfileCreateDialogData {
  readonly projectId: string;
}

const LEVELS: ReadonlyArray<{ value: ExperienceLevel; label: string }> = [
  { value: 'junior', label: 'Junior' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'senior', label: 'Senior' },
  { value: 'expert', label: 'Expert' },
];

/**
 * Dialogue de création rapide d'une fiche de poste.
 * Capture les champs essentiels et délègue les détails à la page d'édition.
 */
@Component({
  selector: 'app-job-profile-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button, FormRoot, FormField, TagInput],
  template: `
    <app-modal-shell
      title="Nouvelle fiche de poste"
      subtitle="Décrivez l'essentiel — vous pourrez compléter les détails ensuite."
    >
      <form
        [formRoot]="profileForm"
        (submit)="onSubmit()"
        novalidate
        class="space-y-4"
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Intitulé du poste *</span>
          <input
            type="text"
            [formField]="profileForm.title"
            class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="Ex. Développeur Backend Java"
          />
          @if (profileForm.title().touched() && profileForm.title().errors().length > 0) {
            <span class="text-xs font-medium text-red-600">
              {{ profileForm.title().errors()[0].message }}
            </span>
          }
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Niveau *</span>
            <select
              [formField]="profileForm.experienceLevel"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            >
              @for (level of levels; track level.value) {
                <option [value]="level.value">{{ level.label }}</option>
              }
            </select>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Localisation</span>
            <input
              type="text"
              [formField]="profileForm.location"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
              placeholder="Ex. Paris / hybride"
            />
          </label>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Compétences requises</span>
          <app-tag-input
            [(value)]="requiredSkills"
            placeholder="Ex. Java, Spring, PostgreSQL…"
          />
        </div>
      </form>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="profileForm().submitting()"
          (click)="onSubmit()"
        >
          Créer la fiche
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class JobProfileCreateDialog {
  static readonly DATA = new InjectionToken<JobProfileCreateDialogData>(
    'JobProfileCreateDialogData',
  );

  private readonly data = inject(JobProfileCreateDialog.DATA);
  private readonly dialogRef = inject(DialogRef<JobProfile | null, JobProfileCreateDialog>);
  private readonly profilesService = inject(JobProfilesService);
  private readonly toaster = inject(ToastService);

  protected readonly levels = LEVELS;
  protected readonly requiredSkills = signal<ReadonlyArray<string>>([]);

  protected readonly model = signal<Model>({
    title: '',
    experienceLevel: 'confirme',
    location: '',
  });

  protected readonly profileForm = form(this.model, (path) => {
    required(path.title, { message: "L'intitulé est requis" });
    minLength(path.title, 2, { message: 'Au moins 2 caractères' });
    maxLength(path.title, 200, { message: 'Au maximum 200 caractères' });
    maxLength(path.location, 200, { message: 'Au maximum 200 caractères' });
  });

  protected readonly canSubmit = computed(
    () => this.profileForm().valid() && !this.profileForm().submitting(),
  );

  protected onSubmit(): void {
    submit(this.profileForm, async () => {
      const m = this.model();
      try {
        const created = await firstValueFrom(
          this.profilesService.create(this.data.projectId, {
            title: m.title.trim(),
            experienceLevel: m.experienceLevel,
            location: m.location.trim(),
            requiredSkills: [...this.requiredSkills()],
            optionalSkills: [],
            missions: '',
            education: '',
            specificRequirements: [],
            quantityNeeded: 1,
          }),
        );
        this.toaster.success({ title: 'Fiche de poste créée' });
        this.dialogRef.close(created);
      } catch {
        this.toaster.error({
          title: 'Création impossible',
          description: 'Veuillez réessayer dans un instant.',
        });
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
