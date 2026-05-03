import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  updateSystemPromptSchema,
  type UpdateSystemPromptDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { SystemPromptsService } from './system-prompts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('system-prompts')
export class SystemPromptsController {
  constructor(private readonly prompts: SystemPromptsService) {}

  @Get()
  @Roles(['admin'])
  findAll() {
    return this.prompts.findAll();
  }

  @Get(':name')
  @Roles(['admin'])
  findByName(@Param('name') name: string) {
    return this.prompts.findByName(name);
  }

  @Patch(':name')
  @Roles(['admin'])
  update(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
    @Body(new ZodValidationPipe(updateSystemPromptSchema))
    dto: UpdateSystemPromptDto,
  ) {
    return this.prompts.update(name, user.id, dto);
  }
}
