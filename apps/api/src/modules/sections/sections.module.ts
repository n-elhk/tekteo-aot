import { Module } from '@nestjs/common';
import { SystemPromptsModule } from '../system-prompts/system-prompts.module';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';

@Module({
  imports: [SystemPromptsModule],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
