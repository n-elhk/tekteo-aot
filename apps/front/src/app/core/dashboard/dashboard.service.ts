import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { DashboardOverview } from '@org/types';

const DASHBOARD_BASE = '/api/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  readonly overviewRs = httpResource<DashboardOverview>(
    () => `${DASHBOARD_BASE}/overview`,
  );
}
