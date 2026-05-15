import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  CreateCvVariantDto,
  CvVariant,
  GeneratedCvSummary,
  UpdateCvVariantDto,
} from './cv-variant.model';

@Injectable({ providedIn: 'root' })
export class CvVariantsService {
  private readonly http = inject(HttpClient);

  listForConsultant(consultantId: string) {
    return this.http.get<CvVariant[]>(`/api/consultants/${consultantId}/variants`);
  }

  create(consultantId: string, dto: CreateCvVariantDto) {
    return this.http.post<{ variant: CvVariant; usage: { tokensUsed: number; modelUsed: string } }>(
      `/api/consultants/${consultantId}/variants`,
      dto,
    );
  }

  findOne(id: string) {
    return this.http.get<CvVariant>(`/api/variants/${id}`);
  }

  update(id: string, dto: UpdateCvVariantDto) {
    return this.http.patch<CvVariant>(`/api/variants/${id}`, dto);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/variants/${id}`);
  }

  regenerate(id: string) {
    return this.http.post<{ variant: CvVariant; usage: { tokensUsed: number; modelUsed: string } }>(
      `/api/variants/${id}/regenerate`,
      {},
    );
  }

  triggerPdf(id: string) {
    return this.http.post<GeneratedCvSummary>(
      `/api/variants/${id}/generated-cvs`,
      {},
    );
  }

  downloadPdfUrl(variantId: string, genId: string) {
    return `/api/variants/${variantId}/generated-cvs/${genId}/download`;
  }

  removePdf(variantId: string, genId: string) {
    return this.http.delete<void>(`/api/variants/${variantId}/generated-cvs/${genId}`);
  }
}
