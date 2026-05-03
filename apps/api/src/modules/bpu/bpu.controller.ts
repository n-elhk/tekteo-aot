import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  bulkUpsertBpuLinesSchema,
  createBpuLineSchema,
  updateBpuLineSchema,
  type BulkUpsertBpuLinesDto,
  type CreateBpuLineDto,
  type UpdateBpuLineDto,
} from '@org/schemas';
import type { BpuLineType } from '../../generated/prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BpuService } from './bpu.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class BpuController {
  constructor(private readonly bpu: BpuService) {}

  @Get('projects/:projectId/bpu-lines')
  findAllByProject(@Param('projectId') projectId: string) {
    return this.bpu.findAllByProject(projectId);
  }

  @Post('projects/:projectId/bpu-lines')
  @Roles(['admin', 'redacteur'])
  create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createBpuLineSchema)) dto: CreateBpuLineDto,
  ) {
    return this.bpu.create(projectId, dto);
  }

  @Post('projects/:projectId/bpu-lines/bulk')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  bulkUpsert(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(bulkUpsertBpuLinesSchema))
    dto: BulkUpsertBpuLinesDto,
  ) {
    return this.bpu.bulkUpsert(projectId, dto);
  }

  @Patch('bpu-lines/:id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBpuLineSchema)) dto: UpdateBpuLineDto,
  ) {
    return this.bpu.update(id, dto);
  }

  @Delete('bpu-lines/:id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.bpu.remove(id);
  }

  @Delete('projects/:projectId/bpu-lines')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async removeAll(
    @Param('projectId') projectId: string,
    @Query('lineType') lineType: BpuLineType,
  ) {
    await this.bpu.removeAllForType(projectId, lineType);
  }
}
