import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { CV_IMPORT_QUEUE, QueueModule } from '../../common/queue/queue.module';
import { ConsultantCvsController } from './consultant-cvs.controller';
import { ConsultantCvsService } from './consultant-cvs.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportProcessor } from './cv-import.processor';
import { CvImportService } from './cv-import.service';

@Module({
  imports: [
    AuthModule,
    QueueModule,
    BullModule.registerQueue({ name: CV_IMPORT_QUEUE }),
  ],
  controllers: [ConsultantCvsController],
  providers: [ConsultantCvsService, CvImportService, CvImportProcessor, CvImportEventService],
  exports: [ConsultantCvsService],
})
export class ConsultantCvsModule {}
