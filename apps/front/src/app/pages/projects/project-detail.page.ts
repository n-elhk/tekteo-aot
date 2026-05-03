import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { Project } from '@org/types';
import { ProjectsService } from '../../core/projects/projects.service';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { ToastService } from '../../core/notifications/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ProjectStatusBadge } from '../../shared/ui/project-status-badge/project-status-badge';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { SectionsPanel } from '../sections/sections-panel';
import { JobProfilesPanel } from '../job-profiles/job-profiles-panel';
import { BpuPanel } from '../bpu/bpu-panel';

/**
 * Page de détail d'un projet AO. Reçoit `id` via l'URL grâce à
 * `withComponentInputBinding()` (configuré dans app.config.ts).
 */
@Component({
  selector: 'app-project-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Card,
    Button,
    ProjectStatusBadge,
    SectionsPanel,
    JobProfilesPanel,
    BpuPanel,
    DatePipe,
  ],
  templateUrl: './project-detail.page.html',
})
export class ProjectDetailPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(AppDialogService);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);

  /** Identifiant du projet, fourni automatiquement par le routeur. */
  readonly id = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly isAdmin = this.authStore.isAdmin;

  protected readonly resource = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.projectsService.get(params),
  });

  protected readonly project = computed<Project | null>(() => this.resource.value() ?? null);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected async deleteProject(): Promise<void> {
    const project = this.project();
    if (!project) return;
    const ref = this.dialog.open<ConfirmDialog, void, boolean>(ConfirmDialog, {
      data: undefined,
      providers: [
        {
          provide: ConfirmDialog.DATA,
          useValue: {
            title: `Supprimer le projet ?`,
            description: `« ${project.name} » sera définitivement supprimé. Cette action est irréversible.`,
            confirmLabel: 'Supprimer',
            variant: 'danger' as const,
          },
        },
      ],
    });
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;
    this.projectsService.remove(project.id).subscribe({
      next: () => {
        this.toaster.success({ title: 'Projet supprimé' });
        this.router.navigate(['/projects']);
      },
      error: () => {
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        });
      },
    });
  }
}
