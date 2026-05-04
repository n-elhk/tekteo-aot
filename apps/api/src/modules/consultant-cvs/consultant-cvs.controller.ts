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
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { concat, map, Observable, of } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  adaptCvToJobSchema,
  createConsultantCvSchema,
  cvImportTemplateSchema,
  formatCvFromTextSchema,
  updateConsultantCvSchema,
  type AdaptCvToJobDto,
  type CreateConsultantCvDto,
  type CvImportTemplateValue,
  type FormatCvFromTextDto,
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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultant-cvs')
export class ConsultantCvsController {
  constructor(
    private readonly cvs: ConsultantCvsService,
    private readonly imports: CvImportService,
    private readonly importEvents: CvImportEventService,
  ) {}

  @Get()
  findAll() {
    return this.cvs.findAll();
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

  // --------------------------------------------------------
  // Import async depuis fichier PDF/DOCX (worker IA)
  // --------------------------------------------------------
  @Post('import-from-file')
  @Roles(['admin', 'redacteur'])
  @UseInterceptors(FileInterceptor('file'))
  importFromFile(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('templateId', new ZodValidationPipe(cvImportTemplateSchema))
    templateId: CvImportTemplateValue,
  ) {
    return this.imports.createImport(user.id, file, templateId);
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
        toEvent({ status: job.status, error: job.error, cvId: job.cvId }),
      );
    }

    return concat(
      of(toEvent({ status: job.status })),
      this.importEvents.watch(jobId).pipe(map(toEvent)),
    );
  }
}
