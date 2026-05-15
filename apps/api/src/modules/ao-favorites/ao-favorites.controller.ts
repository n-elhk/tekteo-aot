import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  createAoFavoriteSchema,
  type CreateAoFavoriteDto,
} from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { AoFavoritesService } from './ao-favorites.service';

@Controller('ao-favorites')
export class AoFavoritesController {
  constructor(private readonly favorites: AoFavoritesService) {}

  @Get()
  findAll(@ActiveUser() user: ActiveUserData) {
    return this.favorites.findAllForUser(user.sub);
  }

  @Post()
  create(
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(createAoFavoriteSchema))
    dto: CreateAoFavoriteDto,
  ) {
    return this.favorites.create(user.sub, dto);
  }

  @Delete(':aoId')
  @HttpCode(204)
  async remove(
    @ActiveUser() user: ActiveUserData,
    @Param('aoId') aoId: string,
  ) {
    await this.favorites.removeByAoId(user.sub, aoId);
  }
}
