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
  createSectionTemplateSchema,
  updateSectionTemplateSchema,
  type CreateSectionTemplateDto,
  type UpdateSectionTemplateDto,
} from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { SectionTemplatesService } from './section-templates.service';

@Controller('section-templates')
export class SectionTemplatesController {
  constructor(private readonly templates: SectionTemplatesService) {}

  // Tous les rôles peuvent lire (pour utiliser un template lors de la création de section)
  @Get()
  findAll() {
    return this.templates.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  // Mutations admin uniquement
  @Post()
  @Roles(['admin'])
  create(
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(createSectionTemplateSchema))
    dto: CreateSectionTemplateDto,
  ) {
    return this.templates.create(user.sub, dto);
  }

  @Patch(':id')
  @Roles(['admin'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSectionTemplateSchema))
    dto: UpdateSectionTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.templates.remove(id);
  }
}
