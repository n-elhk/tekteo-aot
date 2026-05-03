import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import type { Project } from '@org/types';
import { ProjectsService } from '../../core/projects/projects.service';
import { Card } from '../../shared/ui/card/card';
import { ProjectStatusBadge } from '../../shared/ui/project-status-badge/project-status-badge';
import {
  CalendarMonth,
  DAY_NAMES,
  MONTH_NAMES,
  UrgencyVisual,
  buildMonthGrid,
  dateKey,
  extractDateKey,
  nextMonth,
  previousMonth,
  startOfToday,
  urgencyOf,
} from './calendar.helpers';

interface DayCell {
  readonly day: number | null;
  readonly key: string | null;
  readonly projects: ReadonlyArray<Project>;
  readonly isToday: boolean;
}

interface UpcomingProject {
  readonly project: Project;
  readonly urgency: UrgencyVisual;
}

/**
 * Vue calendrier des échéances de projets.
 *
 * Aucun endpoint dédié : on agrège côté front les projets ayant une `deadline`.
 * Les helpers du calendrier sont extraits dans des fonctions pures
 * (cf. `calendar.helpers.ts`) pour rester testables et indépendants d'Angular.
 */
@Component({
  selector: 'app-calendar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, ProjectStatusBadge, DatePipe],
  templateUrl: './calendar.page.html',
})
export class CalendarPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly today = startOfToday();

  protected readonly dayNames = DAY_NAMES;

  protected readonly resource = rxResource({
    stream: () => this.projectsService.list(),
  });

  protected readonly projects = computed<Project[]>(
    () => this.resource.value()?.filter((p) => p.deadline) ?? [],
  );
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly current = signal<CalendarMonth>({
    year: this.today.getFullYear(),
    month: this.today.getMonth(),
  });

  protected readonly selectedKey = signal<string | null>(null);

  /** Index `YYYY-MM-DD` → projets, recalculé quand la liste change. */
  protected readonly projectsByDate = computed(() => {
    const map = new Map<string, Project[]>();
    for (const project of this.projects()) {
      const key = extractDateKey(project.deadline);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(project);
      else map.set(key, [project]);
    }
    return map;
  });

  protected readonly cells = computed<DayCell[]>(() => {
    const month = this.current();
    const grid = buildMonthGrid(month);
    const todayYear = this.today.getFullYear();
    const todayMonth = this.today.getMonth();
    const todayDay = this.today.getDate();
    const byDate = this.projectsByDate();

    return grid.map((day) => {
      if (day === null) {
        return { day: null, key: null, projects: [], isToday: false } satisfies DayCell;
      }
      const key = dateKey(month, day);
      return {
        day,
        key,
        projects: byDate.get(key) ?? [],
        isToday:
          month.year === todayYear && month.month === todayMonth && day === todayDay,
      } satisfies DayCell;
    });
  });

  protected readonly monthLabel = computed(() => {
    const c = this.current();
    return `${MONTH_NAMES[c.month]} ${c.year}`;
  });

  protected readonly selectedProjects = computed<Project[]>(() => {
    const key = this.selectedKey();
    if (!key) return [];
    return this.projectsByDate().get(key) ?? [];
  });

  protected readonly upcoming = computed<UpcomingProject[]>(() => {
    const projects = this.projects();
    const todayMs = this.today.getTime();
    return projects
      .filter((p) => {
        if (!p.deadline) return false;
        const date = new Date(p.deadline);
        return !Number.isNaN(date.getTime()) && date.getTime() >= todayMs;
      })
      .slice(0, 6)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
      .map((project) => ({
        project,
        urgency: urgencyOf(project.deadline as string, this.today),
      }));
  });

  protected goPrev(): void {
    this.current.update(previousMonth);
    this.selectedKey.set(null);
  }

  protected goNext(): void {
    this.current.update(nextMonth);
    this.selectedKey.set(null);
  }

  protected goToday(): void {
    this.current.set({
      year: this.today.getFullYear(),
      month: this.today.getMonth(),
    });
    this.selectedKey.set(null);
  }

  protected select(cell: DayCell): void {
    if (cell.key === null) return;
    this.selectedKey.set(cell.key === this.selectedKey() ? null : cell.key);
  }

  protected urgencyOfDeadline(deadline: string | null): UrgencyVisual | null {
    if (!deadline) return null;
    return urgencyOf(deadline, this.today);
  }
}
