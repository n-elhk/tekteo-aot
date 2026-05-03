import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GenerationHistoryController } from './generation-history.controller';
import { GenerationHistoryService } from './generation-history.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [GenerationHistoryController],
  providers: [GenerationHistoryService],
  exports: [GenerationHistoryService],
})
export class GenerationHistoryModule {}
