import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AoController } from './ao.controller';
import { AoService } from './ao.service';
import { BoampClient } from './boamp.client';
import { BraveSearchClient } from './brave-search.client';

@Module({
  imports: [AuthModule],
  controllers: [AoController],
  providers: [AoService, BoampClient, BraveSearchClient],
  exports: [AoService, BoampClient],
})
export class AoModule {}
