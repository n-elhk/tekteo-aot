import { Injectable, NotFoundException } from '@nestjs/common';
import type { BpuLineType } from '../../generated/prisma/client';
import type {
  BulkUpsertBpuLinesDto,
  CreateBpuLineDto,
  UpdateBpuLineDto,
} from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BpuService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByProject(projectId: string) {
    return this.prisma.bpuLine.findMany({
      where: { projectId },
      orderBy: [{ lineType: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async findOne(id: string) {
    const line = await this.prisma.bpuLine.findUnique({ where: { id } });
    if (!line) {
      throw new NotFoundException(`Ligne BPU ${id} introuvable`);
    }
    return line;
  }

  create(projectId: string, dto: CreateBpuLineDto) {
    return this.prisma.bpuLine.create({
      data: {
        projectId,
        profileTitle: dto.profileTitle,
        experienceLevel: dto.experienceLevel,
        unit: dto.unit,
        quantity: dto.quantity.toString(),
        unitPrice: dto.unitPrice.toString(),
        lineType: dto.lineType,
        phase: dto.phase ?? null,
        orderIndex: dto.orderIndex,
      },
    });
  }

  async update(id: string, dto: UpdateBpuLineDto) {
    await this.findOne(id);
    return this.prisma.bpuLine.update({
      where: { id },
      data: {
        ...(dto.profileTitle !== undefined && { profileTitle: dto.profileTitle }),
        ...(dto.experienceLevel !== undefined && { experienceLevel: dto.experienceLevel }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity.toString() }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice.toString() }),
        ...(dto.lineType !== undefined && { lineType: dto.lineType }),
        ...(dto.phase !== undefined && { phase: dto.phase || null }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.bpuLine.delete({ where: { id } });
  }

  async removeAllForType(projectId: string, lineType: BpuLineType) {
    await this.prisma.bpuLine.deleteMany({
      where: { projectId, lineType },
    });
  }

  /**
   * Bulk upsert : utile pour l'import CSV/Excel ou une sauvegarde
   * complète depuis le front (table éditable inline).
   */
  async bulkUpsert(projectId: string, dto: BulkUpsertBpuLinesDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.replace) {
        await tx.bpuLine.deleteMany({
          where: { projectId, lineType: dto.lineType },
        });
      }

      const created = await Promise.all(
        dto.lines.map((line, index) =>
          tx.bpuLine.create({
            data: {
              projectId,
              profileTitle: line.profileTitle,
              experienceLevel: line.experienceLevel,
              unit: line.unit,
              quantity: line.quantity.toString(),
              unitPrice: line.unitPrice.toString(),
              lineType: dto.lineType,
              phase: line.phase ?? null,
              orderIndex: line.orderIndex || index,
            },
          }),
        ),
      );

      return { count: created.length, lines: created };
    });
  }
}
