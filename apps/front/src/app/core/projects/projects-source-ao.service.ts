import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import type { Project } from '@org/types';

const API = '/api/projects';

/**
 * Suit l'ensemble des `sourceAoId` déjà importés en projets, afin que la
 * vue Veille puisse afficher l'état « Déjà importé » sans recharger toute
 * la liste à chaque interaction.
 *
 * Approche : un fetch unique de `/api/projects` à l'instanciation, puis
 * maintenu à jour côté client par `markAsImported()` lorsqu'un projet est
 * créé depuis la veille.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsSourceAoService {
  private readonly http = inject(HttpClient);

  private readonly importedResource = rxResource({
    stream: () =>
      this.http.get<Project[]>(API).pipe(
        map((projects) => {
          const map = new Map<string, string>();
          for (const project of projects) {
            if (project.sourceAoId) map.set(project.sourceAoId, project.id);
          }
          return map as ReadonlyMap<string, string>;
        }),
      ),
    defaultValue: new Map<string, string>() as ReadonlyMap<string, string>,
  });

  readonly importedMap = linkedSignal(() => this.importedResource.value());
  readonly loaded = computed(() => this.importedResource.status() === 'resolved');

  /** Indicateur dérivé : pratique pour les templates `@if`. */
  readonly importedCount = computed(() => this.importedMap().size);

  isImported(aoId: string): boolean {
    return this.importedMap().has(aoId);
  }

  getProjectId(aoId: string): string | null {
    return this.importedMap().get(aoId) ?? null;
  }

  /** Marque un AO comme importé sans nouvel appel HTTP (mise à jour optimiste). */
  markAsImported(aoId: string, projectId: string): void {
    this.importedMap.update((current) => {
      if (current.has(aoId)) return current;
      const next = new Map(current);
      next.set(aoId, projectId);
      return next;
    });
  }
}
