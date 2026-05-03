import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateSectionTemplateDto,
  UpdateSectionTemplateDto,
} from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SectionTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.sectionTemplate.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        _count: { select: { sections: true } },
      },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.sectionTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!template) {
      throw new NotFoundException(`Template ${id} introuvable`);
    }
    return template;
  }

  create(userId: string, dto: CreateSectionTemplateDto) {
    return this.prisma.sectionTemplate.create({
      data: { ...dto, createdById: userId },
    });
  }

  async update(id: string, dto: UpdateSectionTemplateDto) {
    await this.findOne(id);
    return this.prisma.sectionTemplate.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.sectionTemplate.delete({ where: { id } });
  }
}
