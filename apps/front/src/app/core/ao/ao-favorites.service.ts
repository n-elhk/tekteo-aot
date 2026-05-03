import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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

  private readonly _favorites = signal<ReadonlyArray<AoFavorite>>([]);
  private readonly _loaded = signal(false);

  readonly favorites = this._favorites.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Ensemble des `aoId` favoris (pour des recherches O(1)). */
  readonly favoriteIds = computed(
    () => new Set(this._favorites().map((favorite) => favorite.aoId)),
  );

  isFavorite(aoId: string): boolean {
    return this.favoriteIds().has(aoId);
  }

  /** Charge les favoris depuis l'API si ce n'est pas déjà fait. */
  ensureLoaded(): void {
    if (this._loaded()) return;
    this.http.get<AoFavorite[]>(API).subscribe({
      next: (favorites) => {
        this._favorites.set(favorites);
        this._loaded.set(true);
      },
      error: () => this._loaded.set(true),
    });
  }

  add(ao: AoItem) {
    const dto: CreateAoFavoriteDto = { aoId: ao.id, aoData: ao };
    return this.http.post<AoFavorite>(API, dto).pipe(
      tap((favorite) => {
        this._favorites.update((current) => [favorite, ...current]);
      }),
    );
  }

  remove(aoId: string) {
    return this.http.delete<void>(`${API}/${aoId}`).pipe(
      tap(() => {
        this._favorites.update((current) =>
          current.filter((favorite) => favorite.aoId !== aoId),
        );
      }),
    );
  }
}
