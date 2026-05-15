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
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { ConsultantsService } from './consultants.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';
import { MasterCvPdfService } from './master-cv-pdf.service';

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
    @ActiveUser() user: ActiveUserData,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.masterPdf.render(
      id,
      template,
      user.sub,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Post()
  @Roles(['admin', 'redacteur'])
  create(
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(createConsultantSchema)) dto: CreateConsultantDto,
  ) {
    return this.consultants.create(user.sub, dto);
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
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(importConsultantFromTextSchema))
    dto: ImportConsultantFromTextDto,
  ) {
    return this.consultants.importFromText(user.sub, dto);
  }

  @Post('import/file')
  @Roles(['admin', 'redacteur'])
  @UseInterceptors(FilesInterceptor('files', 10))
  importFromFile(
    @ActiveUser() user: ActiveUserData,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imports.createBulkImports(user.sub, files);
  }

  @Get('import-jobs/:jobId')
  getImportJob(@Param('jobId') jobId: string, @ActiveUser() user: ActiveUserData) {
    return this.imports.getJob(jobId, user.sub);
  }

  @Sse('import-jobs/:jobId/events')
  async watchImportJob(
    @Param('jobId') jobId: string,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Observable<MessageEvent>> {
    const job = await this.imports.getJob(jobId, user.sub);
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
