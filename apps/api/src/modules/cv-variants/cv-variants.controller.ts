import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createCvVariantSchema,
  regenerateCvVariantSchema,
  updateCvVariantSchema,
  type CreateCvVariantDto,
  type RegenerateCvVariantDto,
  type UpdateCvVariantDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { CvVariantsService } from './cv-variants.service';
import { CvVariantPdfService } from './cv-variant-pdf.service';
import { GeneratedCvsService } from './generated-cvs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CvVariantsController {
  constructor(
    private readonly variants: CvVariantsService,
    private readonly variantPdf: CvVariantPdfService,
    private readonly generated: GeneratedCvsService,
  ) {}

  @Get('consultants/:consultantId/variants')
  list(@Param('consultantId') consultantId: string) {
    return this.variants.listForConsultant(consultantId);
  }

  @Post('consultants/:consultantId/variants')
  @Roles(['admin', 'redacteur'])
  @HttpCode(201)
  create(
    @Param('consultantId') consultantId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCvVariantSchema)) dto: CreateCvVariantDto,
  ) {
    return this.variants.create(consultantId, user.id, dto);
  }

  @Get('variants/:id')
  findOne(@Param('id') id: string) {
    return this.variants.findOne(id);
  }

  @Patch('variants/:id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCvVariantSchema)) dto: UpdateCvVariantDto,
  ) {
    return this.variants.update(id, dto);
  }

  @Delete('variants/:id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.variants.remove(id);
  }

  @Post('variants/:id/regenerate')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  regenerate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(regenerateCvVariantSchema))
    _dto: RegenerateCvVariantDto,
  ) {
    return this.variants.regenerate(id, user.id);
  }

  @Post('variants/:id/generated-cvs')
  @Roles(['admin', 'redacteur'])
  @HttpCode(201)
  triggerPdf(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.variantPdf.render(id, user.id);
  }

  @Get('variants/:variantId/generated-cvs/:genId/download')
  async download(
    @Param('variantId') variantId: string,
    @Param('genId') genId: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.generated.getDownload(genId, variantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Delete('variants/:variantId/generated-cvs/:genId')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async removeGenerated(
    @Param('variantId') variantId: string,
    @Param('genId') genId: string,
  ) {
    await this.generated.remove(genId, variantId);
  }
}
