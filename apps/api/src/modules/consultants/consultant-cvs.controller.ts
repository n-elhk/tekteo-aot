import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { concat, map, Observable, of } from 'rxjs';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  adaptCvToJobSchema,
  consultantCvsListQuerySchema,
  createConsultantCvSchema,
  cvTemplateSchema,
  formatCvFromTextSchema,
  generateCvFromTemplateSchema,
  updateConsultantCvSchema,
  type AdaptCvToJobDto,
  type ConsultantCvsListQueryDto,
  type CreateConsultantCvDto,
  type CvTemplateValue,
  type FormatCvFromTextDto,
  type GenerateCvFromTemplateDto,
  type UpdateConsultantCvDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { ConsultantCvsService } from './consultant-cvs.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';
import { GeneratedCvsService } from './generated-cvs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultant-cvs')
export class ConsultantCvsController {
  constructor(
    private readonly cvs: ConsultantCvsService,
    private readonly imports: CvImportService,
    private readonly importEvents: CvImportEventService,
    private readonly generatedCvs: GeneratedCvsService,
  ) {}

  // -----------------------------------------------------------
  // Profils consultants
  // -----------------------------------------------------------

  @Get()
  findAll(
    @Query(new ZodValidationPipe(consultantCvsListQuerySchema))
    query: ConsultantCvsListQueryDto,
  ) {
    return this.cvs.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cvs.findOne(id);
  }

  @Post()
  @Roles(['admin', 'redacteur'])
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConsultantCvSchema))
    dto: CreateConsultantCvDto,
  ) {
    return this.cvs.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConsultantCvSchema))
    dto: UpdateConsultantCvDto,
  ) {
    return this.cvs.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.cvs.remove(id);
  }

  // -----------------------------------------------------------
  // Extraction depuis texte (legacy — conservé pour compat API)
  // -----------------------------------------------------------

  @Post('format-from-text')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  formatFromText(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(formatCvFromTextSchema))
    dto: FormatCvFromTextDto,
  ) {
    return this.cvs.formatFromText(user.id, dto);
  }

  @Post(':id/adapt-to-job')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  adaptToJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(adaptCvToJobSchema)) dto: AdaptCvToJobDto,
  ) {
    return this.cvs.adaptToJob(id, user.id, dto);
  }

  // -----------------------------------------------------------
  // Import multi-fichier (PDF/DOCX → consultant + CV)
  // -----------------------------------------------------------

  @Post('import-from-file')
  @Roles(['admin', 'redacteur'])
  @UseInterceptors(FilesInterceptor('files', 10))
  importFromFile(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('template', new ZodValidationPipe(cvTemplateSchema))
    template: CvTemplateValue,
  ) {
    return this.imports.createBulkImports(user.id, files, template);
  }

  @Get('import-jobs/:jobId')
  getImportJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.getJob(jobId, user.id);
  }

  @Sse('import-jobs/:jobId/events')
  async watchImportJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Observable<MessageEvent>> {
    const job = await this.imports.getJob(jobId, user.id);
    const toEvent = (data: object): MessageEvent => ({ data });

    if (job.status === 'done' || job.status === 'failed') {
      return of(
        toEvent({
          kind: job.kind,
          status: job.status,
          template: job.template,
          consultantId: job.consultantId,
          generatedCvId: job.generatedCvId,
          error: job.error,
        }),
      );
    }

    return concat(
      of(
        toEvent({
          kind: job.kind,
          status: job.status,
          template: job.template,
        }),
      ),
      this.importEvents.watch(jobId).pipe(map(toEvent)),
    );
  }

  // -----------------------------------------------------------
  // Génération depuis page détail
  // -----------------------------------------------------------

  @Post(':id/generate')
  @Roles(['admin', 'redacteur'])
  generate(
    @Param('id') consultantId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(generateCvFromTemplateSchema))
    dto: GenerateCvFromTemplateDto,
  ) {
    return this.imports.createGenerationJob(
      user.id,
      consultantId,
      dto.template,
    );
  }

  // -----------------------------------------------------------
  // CVs générés — download / delete
  // -----------------------------------------------------------

  @Get(':id/generated-cvs/:genId/download')
  async downloadGeneratedCv(
    @Param('id') consultantId: string,
    @Param('genId') genId: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.generatedCvs.getDownload(
      genId,
      consultantId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    stream.pipe(res);
  }

  @Delete(':id/generated-cvs/:genId')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async removeGeneratedCv(
    @Param('id') consultantId: string,
    @Param('genId') genId: string,
  ) {
    await this.generatedCvs.remove(genId, consultantId);
  }
}
