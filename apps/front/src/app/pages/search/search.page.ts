import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { combineLatest, map } from 'rxjs';
import type { Project } from '@org/types';
import { ProjectsService } from '../../core/projects/projects.service';
import { ConsultantsService } from '../../core/consultants/consultants.service';
import type { ConsultantListItem } from '../../core/consultants/consultant.model';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ProjectStatusBadge } from '../../shared/ui/project-status-badge/project-status-badge';
import { Highlight, snippetAround } from './highlight.pipe';

interface ProjectHit {
  readonly type: 'project';
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly snippet: string;
  readonly status: Project['status'];
  readonly link: ReadonlyArray<string | number>;
}

interface CvHit {
  readonly type: 'cv';
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly snippet: string;
  readonly link: ReadonlyArray<string | number>;
}

type Hit = ProjectHit | CvHit;

interface SearchData {
  readonly projects: ReadonlyArray<Project>;
  readonly cvs: ReadonlyArray<ConsultantListItem>;
}

const MIN_QUERY_LENGTH = 2;

/**
 * Page de recherche globale.
 *
 * Effectue une recherche **client-side** sur les projets et les CV consultants
 * déjà chargés depuis l'API. Les sections et fiches de poste ne sont pas
 * indexées globalement (pas d'endpoint dédié) — la recherche se fait depuis
 * la page d'un projet pour ces ressources.
 */
@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, ProjectStatusBadge, Highlight],
  templateUrl: './search.page.html',
})
export class SearchPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly consultantsService = inject(ConsultantsService);

  protected readonly minQueryLength = MIN_QUERY_LENGTH;

  protected readonly draft = signal('');
  protected readonly query = signal('');
  protected readonly submitted = signal(false);

  protected readonly resource = rxResource({
    stream: () =>
      combineLatest([
        this.projectsService.list(),
        this.consultantsService.list({ page: 1, pageSize: 100 }),
      ]).pipe(
        map(([projects, page]): SearchData => ({
          projects,
          cvs: page.items,
        })),
      ),
  });

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly hits = computed<ReadonlyArray<Hit>>(() => {
    const q = this.query().trim().toLowerCase();
    if (q.length < MIN_QUERY_LENGTH) return [];
    const data = this.resource.value();
    if (!data) return [];

    const projectHits = data.projects
      .filter((project) => projectMatches(project, q))
      .map<ProjectHit>((project) => ({
        type: 'project',
        id: project.id,
        title: project.name,
        subtitle: project.clientName,
        snippet: snippetAround(buildProjectHaystack(project), q, 60),
        status: project.status,
        link: ['/projects', project.id],
      }));

    const cvHits = data.cvs
      .filter((cv) => cvMatches(cv, q))
      .map<CvHit>((cv) => ({
        type: 'cv',
        id: cv.id,
        title: consultantFullName(cv),
        subtitle: cv.role ?? '',
        snippet: snippetAround(buildCvHaystack(cv), q, 60),
        link: ['/cv-formatter', 'consultants', cv.id],
      }));

    return [...projectHits, ...cvHits];
  });

  protected readonly projectCount = computed(
    () => this.hits().filter((hit) => hit.type === 'project').length,
  );
  protected readonly cvCount = computed(
    () => this.hits().filter((hit) => hit.type === 'cv').length,
  );

  protected onDraftChange(value: string): void {
    this.draft.set(value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const value = this.draft().trim();
    if (value.length < MIN_QUERY_LENGTH) return;
    this.query.set(value);
    this.submitted.set(true);
  }

  protected reset(): void {
    this.draft.set('');
    this.query.set('');
    this.submitted.set(false);
  }
}

function projectMatches(project: Project, query: string): boolean {
  return buildProjectHaystack(project).toLowerCase().includes(query);
}

function cvMatches(cv: ConsultantListItem, query: string): boolean {
  return buildCvHaystack(cv).toLowerCase().includes(query);
}

function consultantFullName(cv: ConsultantListItem): string {
  const full = `${cv.firstName} ${cv.lastName}`.trim();
  return full.length > 0 ? full : 'Consultant sans nom';
}

function buildProjectHaystack(project: Project): string {
  return [
    project.name,
    project.clientName,
    project.marketReference ?? '',
    project.marketObject ?? '',
    project.technologies.join(' '),
    project.lots.join(' '),
  ].join(' ');
}

function buildCvHaystack(cv: ConsultantListItem): string {
  return [
    consultantFullName(cv),
    cv.role ?? '',
    cv.email ?? '',
    cv.location ?? '',
  ].join(' ');
}
