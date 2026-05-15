import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createJobProfileSchema,
  generateJobProfilesSchema,
  updateJobProfileSchema,
  type CreateJobProfileDto,
  type GenerateJobProfilesDto,
  type UpdateJobProfileDto,
} from '@org/schemas';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { JobProfilesService } from './job-profiles.service';

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
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(generateJobProfilesSchema))
    dto: GenerateJobProfilesDto,
  ) {
    return this.profiles.generateBatch(projectId, user.sub, dto);
  }
}
