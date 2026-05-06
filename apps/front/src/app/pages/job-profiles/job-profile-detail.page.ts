import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { filter, switchMap, tap } from 'rxjs';
import type { UpdateJobProfileDto } from '@org/schemas';
import type { JobProfile, ExperienceLevel } from '../../core/job-profiles/job-profile.model';
import { JobProfilesService } from '../../core/job-profiles/job-profiles.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { TagInput } from '../../shared/ui/tag-input/tag-input';
import { ExperienceLevelBadge } from '../../shared/ui/experience-level-badge/experience-level-badge';
import { SectionStatusBadge } from '../../shared/ui/section-status-badge/section-status-badge';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog/confirm-dialog';

interface EditableModel {
  title: string;
  experienceLevel: ExperienceLevel;
  location: string;
  missions: string;
  education: string;
  marketContext: string;
  duration: string;
  remoteWork: string;
  startDate: string;
  clientSector: string;
  quantityNeeded: number;
  generatedContent: string;
}

const LEVELS: ReadonlyArray<{ value: ExperienceLevel; label: string }> = [
  { value: 'junior', label: 'Junior' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'senior', label: 'Senior' },
  { value: 'expert', label: 'Expert' },
];

/**
 * Page d'édition complète d'une fiche de poste avec champs principaux,
 * compétences (tag inputs), suivi de l'état et génération IA individuelle.
 */
@Component({
  selector: 'app-job-profile-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Card,
    Button,
    TagInput,
    ExperienceLevelBadge,
    SectionStatusBadge,
  ],
  templateUrl: './job-profile-detail.page.html',
})
export class JobProfileDetailPage {
  private readonly profilesService = inject(JobProfilesService);
  private readonly toaster = inject(ToastService);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);

  /** Paramètres injectés par le routeur via `withComponentInputBinding`. */
  readonly id = input.required<string>();
  readonly profileId = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly levels = LEVELS;

  protected readonly resource = rxResource({
    params: () => this.profileId(),
    stream: ({ params }) => this.profilesService.get(params),
  });

  protected readonly profile = computed<JobProfile | null>(() => this.resource.value() ?? null);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly model = signal<EditableModel>(emptyModel());
  protected readonly requiredSkills = signal<ReadonlyArray<string>>([]);
  protected readonly optionalSkills = signal<ReadonlyArray<string>>([]);
  protected readonly specificRequirements = signal<ReadonlyArray<string>>([]);

  protected readonly saving = signal(false);
  protected readonly generating = signal(false);

  protected readonly isDirty = computed(() => {
    const original = this.profile();
    if (!original) return false;
    const current = this.model();
    return (
      current.title !== original.title ||
      current.experienceLevel !== original.experienceLevel ||
      current.location !== original.location ||
      current.missions !== original.missions ||
      current.education !== original.education ||
      current.marketContext !== (original.marketContext ?? '') ||
      current.duration !== (original.duration ?? '') ||
      current.remoteWork !== (original.remoteWork ?? '') ||
      current.startDate !== (original.startDate ?? '') ||
      current.clientSector !== (original.clientSector ?? '') ||
      current.quantityNeeded !== original.quantityNeeded ||
      current.generatedContent !== original.generatedContent ||
      !arrayEquals(this.requiredSkills(), original.requiredSkills) ||
      !arrayEquals(this.optionalSkills(), original.optionalSkills) ||
      !arrayEquals(this.specificRequirements(), original.specificRequirements)
    );
  });

  constructor() {
    // Synchronise les signaux locaux quand la fiche est (re)chargée.
    effect(() => {
      const profile = this.profile();
      if (!profile) return;
      untracked(() => {
        this.model.set({
          title: profile.title,
          experienceLevel: profile.experienceLevel,
          location: profile.location,
          missions: profile.missions,
          education: profile.education,
          marketContext: profile.marketContext ?? '',
          duration: profile.duration ?? '',
          remoteWork: profile.remoteWork ?? '',
          startDate: profile.startDate ?? '',
          clientSector: profile.clientSector ?? '',
          quantityNeeded: profile.quantityNeeded,
          generatedContent: profile.generatedContent,
        });
        this.requiredSkills.set([...profile.requiredSkills]);
        this.optionalSkills.set([...profile.optionalSkills]);
        this.specificRequirements.set([...profile.specificRequirements]);
      });
    });
  }

  protected updateField<K extends keyof EditableModel>(field: K, value: EditableModel[K]): void {
    this.model.update((current) => ({ ...current, [field]: value }));
  }

  protected onTextField(field: keyof EditableModel, value: string): void {
    this.updateField(field, value as never);
  }

  protected onQuantityChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.updateField('quantityNeeded', Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
  }

  protected save(): void {
    const profile = this.profile();
    if (!profile || this.saving()) return;
    const m = this.model();
    const dto: UpdateJobProfileDto = {
      title: m.title.trim(),
      experienceLevel: m.experienceLevel,
      location: m.location.trim(),
      missions: m.missions,
      education: m.education,
      requiredSkills: [...this.requiredSkills()],
      optionalSkills: [...this.optionalSkills()],
      specificRequirements: [...this.specificRequirements()],
      quantityNeeded: m.quantityNeeded,
      generatedContent: m.generatedContent,
      marketContext: m.marketContext || undefined,
      duration: m.duration || undefined,
      remoteWork: m.remoteWork || undefined,
      startDate: m.startDate || undefined,
      clientSector: m.clientSector || undefined,
    };
    this.saving.set(true);
    this.profilesService.update(profile.id, dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.toaster.success({ title: 'Fiche enregistrée' });
        this.resource.reload();
      },
      error: () => {
        this.saving.set(false);
        this.toaster.error({
          title: 'Sauvegarde impossible',
          description: 'Veuillez réessayer dans un instant.',
        });
      },
    });
  }

  protected generate(): void {
    const profile = this.profile();
    if (!profile || this.generating()) return;
    this.generating.set(true);
    this.profilesService
      .generateBatch(this.id(), { profileIds: [profile.id] })
      .subscribe({
        next: (response) => {
          this.generating.set(false);
          const result = response.results[0];
          if (result?.success) {
            this.toaster.success({ title: 'Fiche générée par IA' });
            this.resource.reload();
          } else {
            this.toaster.error({
              title: 'Génération en échec',
              description: result?.error ?? 'Aucune information.',
            });
          }
        },
        error: () => {
          this.generating.set(false);
          this.toaster.error({
            title: 'Génération impossible',
            description: 'Veuillez réessayer dans un instant.',
          });
        },
      });
  }

  protected confirmDelete(): void {
    const profile = this.profile();
    if (!profile) return;
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      ...APP_DIALOG_CONFIG,
      data: {
        title: 'Supprimer cette fiche ?',
        description: `« ${profile.title} » sera définitivement supprimée.`,
        confirmLabel: 'Supprimer',
        variant: 'danger',
      },
    });

    ref.closed
      .pipe(
        filter(Boolean),
        switchMap(() => this.profilesService.remove(profile.id)),
        tap(() => {
          this.toaster.success({ title: 'Fiche supprimée' });
          this.router.navigate(['/projects', this.id()]);
        }),
      )
      .subscribe({
        error: () =>
          this.toaster.error({
            title: 'Suppression impossible',
            description: 'Veuillez réessayer dans un instant.',
          }),
      });
  }
}

function arrayEquals(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function emptyModel(): EditableModel {
  return {
    title: '',
    experienceLevel: 'confirme',
    location: '',
    missions: '',
    education: '',
    marketContext: '',
    duration: '',
    remoteWork: '',
    startDate: '',
    clientSector: '',
    quantityNeeded: 1,
    generatedContent: '',
  };
}
