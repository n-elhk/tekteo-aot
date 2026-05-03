import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectDocumentsController } from './project-documents.controller';
import { ProjectDocumentsService } from './project-documents.service';

@Module({
  imports: [AuthModule],
  controllers: [ProjectDocumentsController],
  providers: [ProjectDocumentsService],
  exports: [ProjectDocumentsService],
})
export class ProjectDocumentsModule {}
