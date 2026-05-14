import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { filter, switchMap, tap } from 'rxjs';
import type { Project, ProjectDetail } from '@org/types';
import { ProjectsService } from '../../core/projects/projects.service';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { ToastService } from '../../core/notifications/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ProjectStatusBadge } from '../../shared/ui/project-status-badge/project-status-badge';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog/confirm-dialog';
import {
  ProjectEditDialog,
  type ProjectEditDialogData,
} from './project-edit-dialog';
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
  private readonly dialog = inject(Dialog);
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

  protected readonly project = computed<ProjectDetail | null>(() => this.resource.value() ?? null);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected editProject(): void {
    const project = this.project();
    if (!project) return;
    const ref = this.dialog.open<Project | null, ProjectEditDialogData, ProjectEditDialog>(
      ProjectEditDialog,
      { ...APP_DIALOG_CONFIG, data: { project } },
    );
    ref.closed.pipe(filter(Boolean)).subscribe(() => this.resource.reload());
  }

  protected deleteProject(): void {
    const project = this.project();
    if (!project) return;
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      ...APP_DIALOG_CONFIG,
      data: {
        title: `Supprimer le projet ?`,
        description: `« ${project.name} » sera définitivement supprimé. Cette action est irréversible.`,
        confirmLabel: 'Supprimer',
        variant: 'danger',
      },
    });

    ref.closed
      .pipe(
        filter(Boolean),
        switchMap(() => this.projectsService.remove(project.id)),
        tap(() => {
          this.toaster.success({ title: 'Projet supprimé' });
          this.router.navigate(['/projects']);
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
