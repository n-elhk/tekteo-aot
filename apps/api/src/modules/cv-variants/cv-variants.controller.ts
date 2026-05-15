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
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { CvVariantsService } from './cv-variants.service';
import { CvVariantPdfService } from './cv-variant-pdf.service';
import { GeneratedCvsService } from './generated-cvs.service';

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
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(createCvVariantSchema)) dto: CreateCvVariantDto,
  ) {
    return this.variants.create(consultantId, user.sub, dto);
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
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(regenerateCvVariantSchema))
    _dto: RegenerateCvVariantDto,
  ) {
    return this.variants.regenerate(id, user.sub);
  }

  @Post('variants/:id/generated-cvs')
  @Roles(['admin', 'redacteur'])
  @HttpCode(201)
  triggerPdf(@Param('id') id: string, @ActiveUser() user: ActiveUserData) {
    return this.variantPdf.render(id, user.sub);
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
