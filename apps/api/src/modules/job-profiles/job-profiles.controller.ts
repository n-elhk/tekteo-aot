import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createJobProfileSchema,
  generateJobProfilesSchema,
  updateJobProfileSchema,
  type CreateJobProfileDto,
  type GenerateJobProfilesDto,
  type UpdateJobProfileDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { JobProfilesService } from './job-profiles.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class JobProfilesController {
  constructor(private readonly profiles: JobProfilesService) {}

  @Get('job-profiles')
  findAll() {
    return this.profiles.findAll();
  }

  @Get('projects/:projectId/job-profiles')
  findAllByProject(@Param('projectId') projectId: string) {
    return this.profiles.findAllByProject(projectId);
  }

  @Get('job-profiles/:id')
  findOne(@Param('id') id: string) {
    return this.profiles.findOne(id);
  }

  @Post('projects/:projectId/job-profiles')
  @Roles(['admin', 'redacteur'])
  create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createJobProfileSchema))
    dto: CreateJobProfileDto,
  ) {
    return this.profiles.create(projectId, dto);
  }

  @Patch('job-profiles/:id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateJobProfileSchema))
    dto: UpdateJobProfileDto,
  ) {
    return this.profiles.update(id, dto);
  }

  @Delete('job-profiles/:id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.profiles.remove(id);
  }

  @Post('projects/:projectId/job-profiles/generate-batch')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  generateBatch(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(generateJobProfilesSchema))
    dto: GenerateJobProfilesDto,
  ) {
    return this.profiles.generateBatch(projectId, user.id, dto);
  }
}
