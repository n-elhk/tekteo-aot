import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { CreateAoFavoriteDto } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AoFavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string) {
    return this.prisma.aoFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateAoFavoriteDto) {
    try {
      return await this.prisma.aoFavorite.create({
        data: {
          userId,
          aoId: dto.aoId,
          aoData: dto.aoData as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Cette annonce est déjà dans vos favoris');
      }
      throw error;
    }
  }

  async removeByAoId(userId: string, aoId: string) {
    const favorite = await this.prisma.aoFavorite.findUnique({
      where: { userId_aoId: { userId, aoId } },
    });
    if (!favorite) {
      throw new NotFoundException('Favori introuvable');
    }
    return this.prisma.aoFavorite.delete({
      where: { userId_aoId: { userId, aoId } },
    });
  }
}
