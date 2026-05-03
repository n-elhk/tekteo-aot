import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AoFavoritesController } from './ao-favorites.controller';
import { AoFavoritesService } from './ao-favorites.service';

@Module({
  imports: [AuthModule],
  controllers: [AoFavoritesController],
  providers: [AoFavoritesService],
  exports: [AoFavoritesService],
})
export class AoFavoritesModule {}
