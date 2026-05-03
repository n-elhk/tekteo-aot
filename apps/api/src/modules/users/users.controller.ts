import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { updateUserSchema, type UpdateUserDto } from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  findMe(@CurrentUser() user: AuthUser) {
    return this.users.findOne(user.id);
  }

  @Get()
  @Roles(['admin'])
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @Roles(['admin'])
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @Roles(['admin'])
  update(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    // Anti self-lockout : un admin ne peut pas se rétrograder lui-même
    if (id === currentUser.id && dto.role && dto.role !== 'admin') {
      throw new BadRequestException(
        "Vous ne pouvez pas modifier votre propre rôle (sécurité anti-self-lockout)",
      );
    }
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin'])
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Anti self-lockout : un admin ne peut pas se supprimer lui-même
    if (id === currentUser.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer votre propre compte',
      );
    }
    await this.users.remove(id);
  }
}
