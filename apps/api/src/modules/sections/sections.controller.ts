import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createSectionSchema,
  generateSectionRequestSchema,
  updateSectionSchema,
  type CreateSectionDto,
  type GenerateSectionRequestDto,
  type UpdateSectionDto,
} from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { SectionsService } from './sections.service';

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
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(generateSectionRequestSchema))
    dto: GenerateSectionRequestDto,
  ) {
    return this.sections.generate(id, user.sub, dto);
  }
}
