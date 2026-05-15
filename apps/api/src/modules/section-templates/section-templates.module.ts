import { Module } from '@nestjs/common';
import { SectionTemplatesController } from './section-templates.controller';
import { SectionTemplatesService } from './section-templates.service';

@Module({
  controllers: [SectionTemplatesController],
  providers: [SectionTemplatesService],
  exports: [SectionTemplatesService],
})
export class SectionTemplatesModule {}
