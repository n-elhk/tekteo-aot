import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createSectionSchema,
  generateSectionRequestSchema,
  updateSectionSchema,
  type CreateSectionDto,
  type GenerateSectionRequestDto,
  type UpdateSectionDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { SectionsService } from './sections.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get('projects/:projectId/sections')
  findAllByProject(@Param('projectId') projectId: string) {
    return this.sections.findAllByProject(projectId);
  }

  @Get('sections/:id')
  findOne(@Param('id') id: string) {
    return this.sections.findOne(id);
  }

  @Post('projects/:projectId/sections')
  @Roles(['admin', 'redacteur'])
  create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createSectionSchema)) dto: CreateSectionDto,
  ) {
    return this.sections.create(projectId, dto);
  }

  @Patch('sections/:id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSectionSchema)) dto: UpdateSectionDto,
  ) {
    return this.sections.update(id, dto);
  }

  @Delete('sections/:id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.sections.remove(id);
  }

  @Post('sections/:id/generate')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  generate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(generateSectionRequestSchema))
    dto: GenerateSectionRequestDto,
  ) {
    return this.sections.generate(id, user.id, dto);
  }
}
