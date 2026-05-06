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
          const ids = new Set<string>();
          for (const project of projects) {
            if (project.sourceAoId) ids.add(project.sourceAoId);
          }
          return ids as ReadonlySet<string>;
        }),
      ),
    defaultValue: new Set<string>() as ReadonlySet<string>,
  });

  readonly importedIds = linkedSignal(() => this.importedResource.value());
  readonly loaded = computed(() => this.importedResource.status() === 'resolved');

  /** Indicateur dérivé : pratique pour les templates `@if`. */
  readonly importedCount = computed(() => this.importedIds().size);

  isImported(aoId: string): boolean {
    return this.importedIds().has(aoId);
  }

  /** Marque un AO comme importé sans nouvel appel HTTP (mise à jour optimiste). */
  markAsImported(aoId: string): void {
    this.importedIds.update((current) => {
      if (current.has(aoId)) return current;
      const next = new Set(current);
      next.add(aoId);
      return next;
    });
  }
}
