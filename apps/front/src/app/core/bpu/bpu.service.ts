import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  BulkUpsertBpuLinesDto,
  CreateBpuLineDto,
  UpdateBpuLineDto,
} from '@org/schemas';
import type { BpuLine } from '@org/types';

export type BpuUnit = 'jour' | 'forfait' | 'mois';
export type BpuLineType = 'bpu' | 'dpgf';
export type { BpuLine };

const API = '/api';

/** Client HTTP pour les lignes BPU / DPGF d'un projet. */
@Injectable({ providedIn: 'root' })
export class BpuService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string): Observable<BpuLine[]> {
    return this.http.get<BpuLine[]>(`${API}/projects/${projectId}/bpu-lines`);
  }

  create(projectId: string, dto: CreateBpuLineDto): Observable<BpuLine> {
    return this.http.post<BpuLine>(`${API}/projects/${projectId}/bpu-lines`, dto);
  }

  update(id: string, dto: UpdateBpuLineDto): Observable<BpuLine> {
    return this.http.patch<BpuLine>(`${API}/bpu-lines/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/bpu-lines/${id}`);
  }

  bulkUpsert(projectId: string, dto: BulkUpsertBpuLinesDto): Observable<BpuLine[]> {
    return this.http.post<BpuLine[]>(`${API}/projects/${projectId}/bpu-lines/bulk`, dto);
  }
}
