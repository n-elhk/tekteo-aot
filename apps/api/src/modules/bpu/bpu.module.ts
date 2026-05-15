import { Module } from '@nestjs/common';
import { BpuController } from './bpu.controller';
import { BpuService } from './bpu.service';

@Module({
  controllers: [BpuController],
  providers: [BpuService],
  exports: [BpuService],
})
export class BpuModule {}
