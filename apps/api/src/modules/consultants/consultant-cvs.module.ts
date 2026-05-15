import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { CV_IMPORT_QUEUE, QueueModule } from '../../common/queue/queue.module';
import { StorageModule } from '../../common/storage/storage.module';
import { ConsultantCvsController } from './consultant-cvs.controller';
import { ConsultantCvsService } from './consultant-cvs.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportProcessor } from './cv-import.processor';
import { CvImportService } from './cv-import.service';
import { GeneratedCvsService } from './generated-cvs.service';
import { PdfRendererService } from './pdf-renderer.service';
import { TemplateFillerService } from './template-filler.service';

@Module({
  imports: [
    AuthModule,
    QueueModule,
    StorageModule,
    BullModule.registerQueue({ name: CV_IMPORT_QUEUE }),
  ],
  controllers: [ConsultantCvsController],
  providers: [
    ConsultantCvsService,
    CvImportService,
    CvImportProcessor,
    CvImportEventService,
    GeneratedCvsService,
    PdfRendererService,
    TemplateFillerService,
  ],
  exports: [ConsultantCvsService, GeneratedCvsService],
})
export class ConsultantCvsModule {}
