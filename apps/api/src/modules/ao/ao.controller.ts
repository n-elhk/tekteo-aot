import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  analyseAoSchema,
  aoSearchQuerySchema,
  type AnalyseAoDto,
  type AoSearchQueryDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { AoService } from './ao.service';

@UseGuards(JwtAuthGuard)
@Controller('ao')
export class AoController {
  constructor(private readonly ao: AoService) {}

  @Get('search')
  search(
    @Query(new ZodValidationPipe(aoSearchQuerySchema))
    query: AoSearchQueryDto,
  ) {
    return this.ao.search(query);
  }

  @Post('analyse')
  @HttpCode(200)
  analyse(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(analyseAoSchema)) dto: AnalyseAoDto,
  ) {
    return this.ao.analyse(user.id, dto);
  }
}
