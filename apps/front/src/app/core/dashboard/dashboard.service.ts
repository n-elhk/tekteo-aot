import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { DashboardOverview } from '@org/types';

const DASHBOARD_BASE = '/api/dashboard';

/**
 * Client HTTP pour le tableau de bord.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>(`${DASHBOARD_BASE}/overview`);
  }
}
