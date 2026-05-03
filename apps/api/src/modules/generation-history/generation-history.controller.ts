import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  generationHistoryQuerySchema,
  type GenerationHistoryQueryDto,
} from '@org/schemas';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { GenerationHistoryService } from './generation-history.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class GenerationHistoryController {
  constructor(private readonly history: GenerationHistoryService) {}

  /**
   * Audit complet — admin uniquement.
   */
  @Get('generation-history')
  @Roles(['admin'])
  findAll(
    @Query(new ZodValidationPipe(generationHistoryQuerySchema))
    query: GenerationHistoryQueryDto,
  ) {
    return this.history.findAll(query);
  }

  /**
   * Statistiques agrégées (tokens / appels par module) — admin.
   */
  @Get('generation-history/stats')
  @Roles(['admin'])
  getStats(
    @Query(new ZodValidationPipe(generationHistoryQuerySchema))
    query: GenerationHistoryQueryDto,
  ) {
    return this.history.getStats(query);
  }

  /**
   * Historique limité à un projet — accessible aux admins/redacteurs du projet.
   */
  @Get('projects/:projectId/generation-history')
  @Roles(['admin', 'redacteur'])
  findByProject(@Param('projectId') projectId: string) {
    return this.history.findByProject(projectId);
  }
}
