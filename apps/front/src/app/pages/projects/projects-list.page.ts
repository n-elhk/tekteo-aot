import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Project, ProjectStatus } from '@org/types';
import { ProjectsService } from '../../core/projects/projects.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ProjectStatusBadge } from '../../shared/ui/project-status-badge/project-status-badge';

type StatusFilter = ProjectStatus | 'all';

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'finalise', label: 'Finalisé' },
  { value: 'soumis', label: 'Soumis' },
];

/**
 * Liste des projets AO avec recherche locale et filtre par statut.
 */
@Component({
  selector: 'app-projects-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, ProjectStatusBadge],
  templateUrl: './projects-list.page.html',
})
export class ProjectsListPage {
  private readonly projectsService = inject(ProjectsService);

  protected readonly search = signal('');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly resource = rxResource({
    stream: () => this.projectsService.list(),
  });

  protected readonly projects = computed<Project[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly errorMessage = computed(() => {
    const err = this.resource.error();
    if (!err) return null;
    return 'Impossible de charger les projets pour le moment.';
  });

  protected readonly filtered = computed<Project[]>(() => {
    const all = this.projects();
    const query = this.search().trim().toLowerCase();
    const statusFilter = this.status();
    return all.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = [
        project.name,
        project.clientName,
        project.marketReference ?? '',
        project.marketObject ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  protected onSearchChange(value: string): void {
    this.search.set(value);
  }

  protected onStatusChange(value: string): void {
    this.status.set(value as StatusFilter);
  }

  protected reload(): void {
    this.resource.reload();
  }

  protected formatDeadline(deadline: string | null): string | null {
    if (!deadline) return null;
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
