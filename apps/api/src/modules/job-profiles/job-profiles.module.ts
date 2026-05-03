import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobProfilesController } from './job-profiles.controller';
import { JobProfilesService } from './job-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [JobProfilesController],
  providers: [JobProfilesService],
  exports: [JobProfilesService],
})
export class JobProfilesModule {}
