import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BpuController } from './bpu.controller';
import { BpuService } from './bpu.service';

@Module({
  imports: [AuthModule],
  controllers: [BpuController],
  providers: [BpuService],
  exports: [BpuService],
})
export class BpuModule {}
