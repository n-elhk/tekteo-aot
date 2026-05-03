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
  createSectionTemplateSchema,
  updateSectionTemplateSchema,
  type CreateSectionTemplateDto,
  type UpdateSectionTemplateDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { SectionTemplatesService } from './section-templates.service';

@UseGuards(JwtAuthGuard, RolesGuard)
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
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSectionTemplateSchema))
    dto: CreateSectionTemplateDto,
  ) {
    return this.templates.create(user.id, dto);
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
