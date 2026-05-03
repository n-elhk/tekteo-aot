import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateUserDto } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

const USER_PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  fullName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_FIELDS,
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }
    return user;
  }

  update(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_FIELDS,
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
      select: USER_PUBLIC_FIELDS,
    });
  }
}
