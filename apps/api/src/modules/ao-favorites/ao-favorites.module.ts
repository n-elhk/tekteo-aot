import { Module } from '@nestjs/common';
import { AoFavoritesController } from './ao-favorites.controller';
import { AoFavoritesService } from './ao-favorites.service';

@Module({
  controllers: [AoFavoritesController],
  providers: [AoFavoritesService],
  exports: [AoFavoritesService],
})
export class AoFavoritesModule {}
