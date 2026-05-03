import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CreateSectionTemplateDto,
  UpdateSectionTemplateDto,
} from '@org/schemas';

export interface SectionTemplate {
  readonly id: string;
  readonly name: string;
  readonly promptTemplate: string;
  readonly defaultContent: string | null;
  readonly orderIndex: number;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly createdBy?: { id: string; email: string; fullName: string | null } | null;
}

const API = '/api/section-templates';

/** Client HTTP des modèles de section (lecture publique, écriture admin). */
@Injectable({ providedIn: 'root' })
export class SectionTemplatesService {
  private readonly http = inject(HttpClient);

  list(): Observable<SectionTemplate[]> {
    return this.http.get<SectionTemplate[]>(API);
  }

  get(id: string): Observable<SectionTemplate> {
    return this.http.get<SectionTemplate>(`${API}/${id}`);
  }

  create(dto: CreateSectionTemplateDto): Observable<SectionTemplate> {
    return this.http.post<SectionTemplate>(API, dto);
  }

  update(id: string, dto: UpdateSectionTemplateDto): Observable<SectionTemplate> {
    return this.http.patch<SectionTemplate>(`${API}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
