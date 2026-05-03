import { Global, Module } from '@nestjs/common';
import { CvWorkerService } from './cv-worker.service';

@Global()
@Module({
  providers: [CvWorkerService],
  exports: [CvWorkerService],
})
export class CvWorkerModule {}
