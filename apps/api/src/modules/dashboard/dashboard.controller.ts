import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

/**
 * Endpoint d'agrégation pour le tableau de bord.
 * Accessible à tout utilisateur authentifié (admin, redacteur, lecteur).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  getOverview() {
    return this.dashboard.getOverview();
  }
}
