import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnthropicModule } from '../common/anthropic/anthropic.module';
import { CvWorkerModule } from '../common/cv-worker/cv-worker.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../common/queue/queue.module';
import { StorageModule } from '../common/storage/storage.module';
import { AoFavoritesModule } from '../modules/ao-favorites/ao-favorites.module';
import { AoModule } from '../modules/ao/ao.module';
import { AuthModule } from '../modules/auth/auth.module';
import { BpuModule } from '../modules/bpu/bpu.module';
import { ConsultantCvsModule } from '../modules/consultant-cvs/consultant-cvs.module';
import { GenerationHistoryModule } from '../modules/generation-history/generation-history.module';
import { JobProfilesModule } from '../modules/job-profiles/job-profiles.module';
import { PricingGridsModule } from '../modules/pricing-grids/pricing-grids.module';
import { ProjectDocumentsModule } from '../modules/project-documents/project-documents.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { SectionTemplatesModule } from '../modules/section-templates/section-templates.module';
import { SectionsModule } from '../modules/sections/sections.module';
import { SystemPromptsModule } from '../modules/system-prompts/system-prompts.module';
import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AnthropicModule,
    CvWorkerModule,
    QueueModule,
    StorageModule,
    GenerationHistoryModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    SectionsModule,
    SectionTemplatesModule,
    SystemPromptsModule,
    JobProfilesModule,
    BpuModule,
    PricingGridsModule,
    ProjectDocumentsModule,
    ConsultantCvsModule,
    AoModule,
    AoFavoritesModule,
  ],
})
export class AppModule {}
