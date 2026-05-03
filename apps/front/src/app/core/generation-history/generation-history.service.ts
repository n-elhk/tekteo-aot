import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { GenerationHistoryQueryDto } from '@org/schemas';
import {
  GenerationHistoryEntry,
  GenerationHistoryPage,
  GenerationHistoryStats,
} from './generation-history.model';

const API = '/api';

/**
 * Client HTTP pour l'historique de générations IA.
 * Note : les endpoints `/generation-history` (liste & stats) sont restreints
 * aux utilisateurs admin côté API.
 */
@Injectable({ providedIn: 'root' })
export class GenerationHistoryService {
  private readonly http = inject(HttpClient);

  list(query: Partial<GenerationHistoryQueryDto>): Observable<GenerationHistoryPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http.get<GenerationHistoryPage>(`${API}/generation-history`, { params });
  }

  stats(query: Partial<GenerationHistoryQueryDto>): Observable<GenerationHistoryStats> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http.get<GenerationHistoryStats>(`${API}/generation-history/stats`, {
      params,
    });
  }

  listByProject(projectId: string): Observable<GenerationHistoryEntry[]> {
    return this.http.get<GenerationHistoryEntry[]>(
      `${API}/projects/${projectId}/generation-history`,
    );
  }
}
