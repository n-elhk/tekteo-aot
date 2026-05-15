import { Module } from '@nestjs/common';
import { JobProfilesController } from './job-profiles.controller';
import { JobProfilesService } from './job-profiles.service';

@Module({
  controllers: [JobProfilesController],
  providers: [JobProfilesService],
  exports: [JobProfilesService],
})
export class JobProfilesModule {}
