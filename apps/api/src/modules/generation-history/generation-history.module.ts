import { Global, Module } from '@nestjs/common';
import { GenerationHistoryController } from './generation-history.controller';
import { GenerationHistoryService } from './generation-history.service';

@Global()
@Module({
  controllers: [GenerationHistoryController],
  providers: [GenerationHistoryService],
  exports: [GenerationHistoryService],
})
export class GenerationHistoryModule {}
