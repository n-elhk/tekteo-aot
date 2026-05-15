import { Module } from '@nestjs/common';
import { AoController } from './ao.controller';
import { AoService } from './ao.service';
import { BoampClient } from './boamp.client';
import { BraveSearchClient } from './brave-search.client';

@Module({
  controllers: [AoController],
  providers: [AoService, BoampClient, BraveSearchClient],
  exports: [AoService, BoampClient],
})
export class AoModule {}
