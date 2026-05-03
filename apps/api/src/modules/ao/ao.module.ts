import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AoController } from './ao.controller';
import { AoService } from './ao.service';
import { BoampClient } from './boamp.client';

@Module({
  imports: [AuthModule],
  controllers: [AoController],
  providers: [AoService, BoampClient],
  exports: [AoService, BoampClient],
})
export class AoModule {}
