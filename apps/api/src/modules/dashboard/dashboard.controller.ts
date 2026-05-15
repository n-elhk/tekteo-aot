import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

/**
 * Endpoint d'agrégation pour le tableau de bord.
 * Accessible à tout utilisateur authentifié (admin, redacteur, lecteur).
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  getOverview() {
    return this.dashboard.getOverview();
  }
}
