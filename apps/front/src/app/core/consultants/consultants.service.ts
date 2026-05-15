import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  Consultant,
  ConsultantsList,
  ConsultantsListQueryDto,
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
} from './consultant.model';

@Injectable({ providedIn: 'root' })
export class ConsultantsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/consultants';

  list(query: ConsultantsListQueryDto) {
    return this.http.get<ConsultantsList>(this.baseUrl, {
      params: { page: String(query.page), pageSize: String(query.pageSize) },
    });
  }

  findOne(id: string) {
    return this.http.get<Consultant>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateConsultantDto) {
    return this.http.post<Consultant>(this.baseUrl, dto);
  }

  update(id: string, dto: UpdateConsultantDto) {
    return this.http.patch<Consultant>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  importFromText(dto: ImportConsultantFromTextDto) {
    return this.http.post<{ consultant: Consultant | null; cvData?: unknown; usage: { tokensUsed: number; modelUsed: string } }>(
      `${this.baseUrl}/import/text`,
      dto,
    );
  }
}
