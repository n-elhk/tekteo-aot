import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectDto,
  UpdateProjectDto,
} from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        _count: { select: { sections: true, jobProfiles: true } },
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        sections: { orderBy: { orderIndex: 'asc' } },
        jobProfiles: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        bpuLines: { orderBy: { orderIndex: 'asc' } },
      },
    });
    if (!project) {
      throw new NotFoundException(`Projet ${id} introuvable`);
    }
    return project;
  }

  create(userId: string, dto: CreateProjectDto) {
    const { deadline, ...rest } = dto;
    return this.prisma.project.create({
      data: {
        ...rest,
        deadline: deadline ? new Date(deadline) : null,
        createdById: userId,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    const { deadline, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(deadline !== undefined
          ? { deadline: deadline ? new Date(deadline) : null }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
