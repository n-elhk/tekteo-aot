import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createAoFavoriteSchema,
  type CreateAoFavoriteDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { AoFavoritesService } from './ao-favorites.service';

@UseGuards(JwtAuthGuard)
@Controller('ao-favorites')
export class AoFavoritesController {
  constructor(private readonly favorites: AoFavoritesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.favorites.findAllForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAoFavoriteSchema))
    dto: CreateAoFavoriteDto,
  ) {
    return this.favorites.create(user.id, dto);
  }

  @Delete(':aoId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('aoId') aoId: string,
  ) {
    await this.favorites.removeByAoId(user.id, aoId);
  }
}
