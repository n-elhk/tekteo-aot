import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import type { JobProfile } from '../../core/job-profiles/job-profile.model';
import { JobProfilesService } from '../../core/job-profiles/job-profiles.service';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { ToastService } from '../../core/notifications/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ExperienceLevelBadge } from '../../shared/ui/experience-level-badge/experience-level-badge';
import { SectionStatusBadge } from '../../shared/ui/section-status-badge/section-status-badge';
import {
  JobProfileCreateDialog,
  JobProfileCreateDialogData,
} from './job-profile-create-dialog';

/**
 * Panneau listant les fiches de poste d'un projet, avec ajout, sélection
 * multiple pour la génération IA en lot et lien vers l'édition détaillée.
 */
@Component({
  selector: 'app-job-profiles-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Card,
    Button,
    ExperienceLevelBadge,
    SectionStatusBadge,
  ],
  templateUrl: './job-profiles-panel.html',
})
export class JobProfilesPanel {
  private readonly profilesService = inject(JobProfilesService);
  private readonly dialog = inject(AppDialogService);
  private readonly toaster = inject(ToastService);
  private readonly authStore = inject(AuthStore);

  readonly projectId = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;

  protected readonly resource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.profilesService.listByProject(params),
  });

  protected readonly profiles = computed<JobProfile[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly selected = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly generating = signal(false);

  protected toggle(profileId: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.profiles().map((p) => p.id)));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected async openCreate(): Promise<void> {
    const ref = this.dialog.open<JobProfileCreateDialog, void, JobProfile | null>(
      JobProfileCreateDialog,
      {
        data: undefined,
        providers: [
          {
            provide: JobProfileCreateDialog.DATA,
            useValue: { projectId: this.projectId() } satisfies JobProfileCreateDialogData,
          },
        ],
      },
    );
    const created = await firstValueFrom(ref.closed);
    if (created) {
      this.resource.reload();
    }
  }

  protected generateSelected(): void {
    if (this.generating() || this.selectedCount() === 0) return;
    const profileIds = Array.from(this.selected());
    this.generating.set(true);
    this.profilesService.generateBatch(this.projectId(), { profileIds }).subscribe({
      next: (response) => {
        this.generating.set(false);
        const successes = response.results.filter((r) => r.success).length;
        const failures = response.results.length - successes;
        if (failures === 0) {
          this.toaster.success({
            title: 'Fiches générées',
            description: `${successes} fiche(s) mise(s) à jour avec succès.`,
          });
        } else if (successes === 0) {
          this.toaster.error({
            title: 'Génération en échec',
            description: `Aucune fiche n'a pu être générée.`,
          });
        } else {
          this.toaster.warning({
            title: 'Génération partielle',
            description: `${successes} succès, ${failures} en échec.`,
          });
        }
        this.clearSelection();
        this.resource.reload();
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
}
