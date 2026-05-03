import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemPromptsModule } from '../system-prompts/system-prompts.module';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';

@Module({
  imports: [AuthModule, SystemPromptsModule],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
