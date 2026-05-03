import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SectionTemplatesController } from './section-templates.controller';
import { SectionTemplatesService } from './section-templates.service';

@Module({
  imports: [AuthModule],
  controllers: [SectionTemplatesController],
  providers: [SectionTemplatesService],
  exports: [SectionTemplatesService],
})
export class SectionTemplatesModule {}
