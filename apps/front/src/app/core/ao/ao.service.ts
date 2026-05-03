import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AnalyseAoDto, AoSearchQueryDto } from '@org/schemas';
import { AoAnalysisResult, AoSearchResponse } from './ao.model';

const API = '/api/ao';

/**
 * Client HTTP pour la recherche BOAMP et l'analyse IA d'un appel d'offres.
 */
@Injectable({ providedIn: 'root' })
export class AoService {
  private readonly http = inject(HttpClient);

  search(query: Partial<AoSearchQueryDto>): Observable<AoSearchResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http.get<AoSearchResponse>(`${API}/search`, { params });
  }

  analyse(dto: AnalyseAoDto): Observable<AoAnalysisResult> {
    return this.http.post<AoAnalysisResult>(`${API}/analyse`, dto);
  }
}
