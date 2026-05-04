import {
  CallHandler,
  createParamDecorator,
  ExecutionContext,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { mixin } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';

export interface UploadedMultipartFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type RequestWithFile = FastifyRequest & { _uploadedFile?: UploadedMultipartFile };

export function FastifyFileInterceptor(fieldName: string): Type<NestInterceptor> {
  class MixinInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      const req = context.switchToHttp().getRequest<RequestWithFile>();
      const body: Record<string, unknown> = {};

      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (part.fieldname === fieldName) {
            const buffer = await part.toBuffer();
            req._uploadedFile = {
              fieldname: part.fieldname,
              originalname: part.filename,
              mimetype: part.mimetype,
              size: buffer.length,
              buffer,
            };
          } else {
            await part.toBuffer();
          }
        } else {
          body[part.fieldname] = part.value;
        }
      }

      Object.assign((req.body as Record<string, unknown>) ?? {}, body);
      return next.handle();
    }
  }

  return mixin(MixinInterceptor);
}

export const UploadedMultipartFile = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UploadedMultipartFile | undefined =>
    ctx.switchToHttp().getRequest<RequestWithFile>()._uploadedFile,
);
