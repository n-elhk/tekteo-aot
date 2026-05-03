import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateSystemPromptDto } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SystemPromptsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.systemPrompt.findMany({
      orderBy: { name: 'asc' },
      include: {
        updatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async findByName(name: string) {
    const prompt = await this.prisma.systemPrompt.findUnique({
      where: { name },
      include: {
        updatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!prompt) {
      throw new NotFoundException(`Prompt "${name}" introuvable`);
    }
    return prompt;
  }

  async update(name: string, userId: string, dto: UpdateSystemPromptDto) {
    await this.findByName(name);
    return this.prisma.systemPrompt.update({
      where: { name },
      data: { ...dto, updatedById: userId },
    });
  }
}
