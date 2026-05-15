import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';
import { CvImportProcessor } from './cv-import.processor';
import { TemplateFillerService } from './template-filler.service';
import { PdfRendererService } from './pdf-renderer.service';
import { MasterCvPdfService } from './master-cv-pdf.service';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BullModule.registerQueue({ name: CV_IMPORT_QUEUE }), AuthModule],
  controllers: [ConsultantsController],
  providers: [
    ConsultantsService,
    CvImportService,
    CvImportEventService,
    CvImportProcessor,
    TemplateFillerService,
    PdfRendererService,
    MasterCvPdfService,
  ],
  exports: [
    ConsultantsService,
    TemplateFillerService,
    PdfRendererService,
  ],
})
export class ConsultantsModule {}
