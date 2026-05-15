import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import {
  analyseAoSchema,
  aoSearchQuerySchema,
  type AnalyseAoDto,
  type AoSearchQueryDto,
} from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { AoService } from './ao.service';

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
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(analyseAoSchema)) dto: AnalyseAoDto,
  ) {
    return this.ao.analyse(user.sub, dto);
  }
}
