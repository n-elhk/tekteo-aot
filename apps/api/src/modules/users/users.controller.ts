import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
} from '@nestjs/common';
import { updateUserSchema, type UpdateUserDto } from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  findMe(@ActiveUser() user: ActiveUserData) {
    return this.users.findOne(user.sub);
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
    @ActiveUser() currentUser: ActiveUserData,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    // Anti self-lockout : un admin ne peut pas se rétrograder lui-même
    if (id === currentUser.sub && dto.role && dto.role !== 'admin') {
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
    @ActiveUser() currentUser: ActiveUserData,
  ) {
    // Anti self-lockout : un admin ne peut pas se supprimer lui-même
    if (id === currentUser.sub) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer votre propre compte',
      );
    }
    await this.users.remove(id);
  }
}
