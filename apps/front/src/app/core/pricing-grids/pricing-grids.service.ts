import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CreatePricingGridDto,
  ExperienceLevelValue,
  UpdatePricingGridDto,
} from '@org/schemas';

export interface PricingGrid {
  readonly id: string;
  readonly profileTitle: string;
  readonly experienceLevel: ExperienceLevelValue;
  readonly dailyRate: string | number;
  readonly region: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly createdAt: string;
}

const API = '/api/pricing-grids';

/** Client HTTP pour les grilles de TJM (lecture publique, écriture admin). */
@Injectable({ providedIn: 'root' })
export class PricingGridsService {
  private readonly http = inject(HttpClient);

  list(): Observable<PricingGrid[]> {
    return this.http.get<PricingGrid[]>(API);
  }

  get(id: string): Observable<PricingGrid> {
    return this.http.get<PricingGrid>(`${API}/${id}`);
  }

  create(dto: CreatePricingGridDto): Observable<PricingGrid> {
    return this.http.post<PricingGrid>(API, dto);
  }

  update(id: string, dto: UpdatePricingGridDto): Observable<PricingGrid> {
    return this.http.patch<PricingGrid>(`${API}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
