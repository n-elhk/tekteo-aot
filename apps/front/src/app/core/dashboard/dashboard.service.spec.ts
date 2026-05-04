import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { DashboardOverview } from '@org/types';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs /api/dashboard/overview and returns the typed payload', () => {
    const fakeOverview: DashboardOverview = {
      projectStats: {
        total: 0,
        byStatus: { brouillon: 0, en_cours: 0, finalise: 0, soumis: 0 },
      },
      tokenStats: { totalTokens: 0, totalCost: 0, byModule: [] },
      recentProjects: [],
    };

    let received: DashboardOverview | undefined;
    service.getOverview().subscribe((res) => (received = res));

    const req = httpMock.expectOne('/api/dashboard/overview');
    expect(req.request.method).toBe('GET');
    req.flush(fakeOverview);

    expect(received).toEqual(fakeOverview);
  });
});
