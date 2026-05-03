import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePricingGridDto,
  UpdatePricingGridDto,
} from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PricingGridsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.pricingGrid.findMany({
      orderBy: [{ profileTitle: 'asc' }, { experienceLevel: 'asc' }],
    });
  }

  async findOne(id: string) {
    const grid = await this.prisma.pricingGrid.findUnique({ where: { id } });
    if (!grid) {
      throw new NotFoundException(`Grille TJM ${id} introuvable`);
    }
    return grid;
  }

  create(dto: CreatePricingGridDto) {
    return this.prisma.pricingGrid.create({
      data: {
        profileTitle: dto.profileTitle,
        experienceLevel: dto.experienceLevel,
        dailyRate: dto.dailyRate.toString(),
        region: dto.region ?? 'Île-de-France',
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
    });
  }

  async update(id: string, dto: UpdatePricingGridDto) {
    await this.findOne(id);
    return this.prisma.pricingGrid.update({
      where: { id },
      data: {
        ...(dto.profileTitle !== undefined && { profileTitle: dto.profileTitle }),
        ...(dto.experienceLevel !== undefined && { experienceLevel: dto.experienceLevel }),
        ...(dto.dailyRate !== undefined && { dailyRate: dto.dailyRate.toString() }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.validFrom !== undefined && {
          validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        }),
        ...(dto.validTo !== undefined && {
          validTo: dto.validTo ? new Date(dto.validTo) : null,
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.pricingGrid.delete({ where: { id } });
  }
}
