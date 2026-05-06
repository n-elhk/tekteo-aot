import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import type { CreateAoFavoriteDto } from '@org/schemas';
import { AoFavorite, AoItem } from './ao.model';

const API = '/api/ao-favorites';

/**
 * Service des favoris d'appels d'offres.
 *
 * Maintient en signal l'ensemble des favoris de l'utilisateur connecté pour
 * pouvoir afficher l'état (favoris/non) dans toutes les vues sans re-fetch.
 */
@Injectable({ providedIn: 'root' })
export class AoFavoritesService {
  private readonly http = inject(HttpClient);

  private readonly favoritesResource = rxResource({
    stream: () => this.http.get<AoFavorite[]>(API),
    defaultValue: [],
  });

  readonly favorites = linkedSignal(() => this.favoritesResource.value());
  readonly loaded = computed(() => this.favoritesResource.status() === 'resolved');

  /** Ensemble des `aoId` favoris (pour des recherches O(1)). */
  readonly favoriteIds = computed(
    () => new Set(this.favorites().map((favorite) => favorite.aoId)),
  );

  isFavorite(aoId: string): boolean {
    return this.favoriteIds().has(aoId);
  }

  add(ao: AoItem) {
    const dto: CreateAoFavoriteDto = { aoId: ao.id, aoData: ao };
    return this.http.post<AoFavorite>(API, dto).pipe(
      tap((favorite) => {
        this.favorites.update((current) => [favorite, ...current]);
      }),
    );
  }

  remove(aoId: string) {
    return this.http.delete<void>(`${API}/${aoId}`).pipe(
      tap(() => {
        this.favorites.update((current) =>
          current.filter((favorite) => favorite.aoId !== aoId),
        );
      }),
    );
  }
}
