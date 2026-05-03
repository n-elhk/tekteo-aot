import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemPromptsController } from './system-prompts.controller';
import { SystemPromptsService } from './system-prompts.service';

@Module({
  imports: [AuthModule],
  controllers: [SystemPromptsController],
  providers: [SystemPromptsService],
  exports: [SystemPromptsService],
})
export class SystemPromptsModule {}
