import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import {
  updateSystemPromptSchema,
  type UpdateSystemPromptDto,
} from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { SystemPromptsService } from './system-prompts.service';

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
    @ActiveUser() user: ActiveUserData,
    @Param('name') name: string,
    @Body(new ZodValidationPipe(updateSystemPromptSchema))
    dto: UpdateSystemPromptDto,
  ) {
    return this.prompts.update(name, user.sub, dto);
  }
}
