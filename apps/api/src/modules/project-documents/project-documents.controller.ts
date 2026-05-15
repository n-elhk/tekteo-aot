import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  documentCategorySchema,
  documentFileTypeSchema,
  updateDocumentSchema,
  type DocumentCategoryValue,
  type DocumentFileTypeValue,
  type UpdateDocumentDto,
} from '@org/schemas';
import type { Response } from 'express';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { ProjectDocumentsService } from './project-documents.service';

@Controller()
export class ProjectDocumentsController {
  constructor(private readonly documents: ProjectDocumentsService) {}

  @Get('projects/:projectId/documents')
  findAllByProject(
    @Param('projectId') projectId: string,
    @Query('category') category?: string,
  ) {
    const parsedCategory = category
      ? (documentCategorySchema.parse(category) as DocumentCategoryValue)
      : undefined;
    return this.documents.findAllByProject(projectId, parsedCategory);
  }

  @Get('documents/:id')
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Post('projects/:projectId/documents')
  @Roles(['admin', 'redacteur'])
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('projectId') projectId: string,
    @ActiveUser() user: ActiveUserData,
    @UploadedFile() file: Express.Multer.File,
    @Body('fileType', new ZodValidationPipe(documentFileTypeSchema))
    fileType: DocumentFileTypeValue,
    @Body('category', new ZodValidationPipe(documentCategorySchema))
    category: DocumentCategoryValue,
  ) {
    return this.documents.upload(projectId, user.sub, file, {
      fileType,
      category,
    });
  }

  @Patch('documents/:id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) dto: UpdateDocumentDto,
  ) {
    return this.documents.update(id, dto);
  }

  @Delete('documents/:id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.documents.remove(id);
  }

  @Get('documents/:id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { doc, stream } = await this.documents.getDownloadInfo(id);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        doc.fileName,
      )}"`,
      ...(doc.fileSize ? { 'Content-Length': doc.fileSize.toString() } : {}),
    });
    stream.pipe(res);
  }
}
