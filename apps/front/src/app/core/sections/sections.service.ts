import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Section } from '@org/types';
import type {
  CreateSectionDto,
  GenerateSectionRequestDto,
  UpdateSectionDto,
} from '@org/schemas';

/** Section incluant son template lié, telle que renvoyée par `GET /sections/:id`. */
export interface SectionWithTemplate extends Section {
  readonly template: SectionTemplateLite | null;
  readonly project: { id: string; name: string; clientName: string };
}

export interface SectionTemplateLite {
  readonly id: string;
  readonly name: string;
  readonly promptTemplate?: string;
  readonly defaultContent?: string | null;
}

export interface GenerateSectionResponse {
  readonly content: string;
  readonly modelUsed: string;
  readonly usage?: { inputTokens?: number; outputTokens?: number };
}

const API = '/api';

/**
 * Client HTTP pour les sections d'un projet AO.
 *
 * Aligné sur les routes du `SectionsController` côté NestJS, utilisées
 * pour le CRUD et la génération IA via Claude.
 */
@Injectable({ providedIn: 'root' })
export class SectionsService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string): Observable<Section[]> {
    return this.http.get<Section[]>(`${API}/projects/${projectId}/sections`);
  }

  get(id: string): Observable<SectionWithTemplate> {
    return this.http.get<SectionWithTemplate>(`${API}/sections/${id}`);
  }

  create(projectId: string, dto: CreateSectionDto): Observable<Section> {
    return this.http.post<Section>(`${API}/projects/${projectId}/sections`, dto);
  }

  update(id: string, dto: UpdateSectionDto): Observable<Section> {
    return this.http.patch<Section>(`${API}/sections/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/sections/${id}`);
  }

  generate(
    id: string,
    dto: GenerateSectionRequestDto,
  ): Observable<GenerateSectionResponse> {
    return this.http.post<GenerateSectionResponse>(
      `${API}/sections/${id}/generate`,
      dto,
    );
  }
}
