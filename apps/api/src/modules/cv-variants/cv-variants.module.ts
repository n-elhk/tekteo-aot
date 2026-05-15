import { Module } from '@nestjs/common';
import { CvVariantsController } from './cv-variants.controller';
import { CvVariantsService } from './cv-variants.service';
import { CvVariantPdfService } from './cv-variant-pdf.service';
import { GeneratedCvsService } from './generated-cvs.service';
import { ConsultantsModule } from '../consultants/consultants.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConsultantsModule, AuthModule],
  controllers: [CvVariantsController],
  providers: [
    CvVariantsService,
    CvVariantPdfService,
    GeneratedCvsService,
  ],
  exports: [GeneratedCvsService],
})
export class CvVariantsModule {}
