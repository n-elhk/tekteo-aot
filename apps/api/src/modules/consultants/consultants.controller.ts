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
  consultantsListQuerySchema,
  createConsultantSchema,
  cvTemplateSchema,
  importConsultantFromTextSchema,
  updateConsultantSchema,
  type ConsultantsListQueryDto,
  type CreateConsultantDto,
  type CvTemplateValue,
  type ImportConsultantFromTextDto,
  type UpdateConsultantDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { ConsultantsService } from './consultants.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';
import { MasterCvPdfService } from './master-cv-pdf.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultants')
export class ConsultantsController {
  constructor(
    private readonly consultants: ConsultantsService,
    private readonly imports: CvImportService,
    private readonly importEvents: CvImportEventService,
    private readonly masterPdf: MasterCvPdfService,
  ) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(consultantsListQuerySchema))
    query: ConsultantsListQueryDto,
  ) {
    return this.consultants.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consultants.findOne(id);
  }

  @Get(':id/master-pdf')
  async downloadMasterPdf(
    @Param('id') id: string,
    @Query('template', new ZodValidationPipe(cvTemplateSchema))
    template: CvTemplateValue,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.masterPdf.render(
      id,
      template,
      user.id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Post()
  @Roles(['admin', 'redacteur'])
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConsultantSchema)) dto: CreateConsultantDto,
  ) {
    return this.consultants.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConsultantSchema)) dto: UpdateConsultantDto,
  ) {
    return this.consultants.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.consultants.remove(id);
  }

  @Post('import/text')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  importFromText(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(importConsultantFromTextSchema))
    dto: ImportConsultantFromTextDto,
  ) {
    return this.consultants.importFromText(user.id, dto);
  }

  @Post('import/file')
  @Roles(['admin', 'redacteur'])
  @UseInterceptors(FilesInterceptor('files', 10))
  importFromFile(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imports.createBulkImports(user.id, files);
  }

  @Get('import-jobs/:jobId')
  getImportJob(@Param('jobId') jobId: string, @CurrentUser() user: AuthUser) {
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
          status: job.status,
          consultantId: job.consultantId,
          error: job.error,
        }),
      );
    }

    return concat(
      of(toEvent({ status: job.status })),
      this.importEvents.watch(jobId).pipe(map(toEvent)),
    );
  }
}
