import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { UpdateSystemPromptDto } from '@org/schemas';

export interface SystemPrompt {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly model: string;
  readonly updatedById: string | null;
  readonly updatedAt: string;
  readonly updatedBy?: { id: string; email: string; fullName: string | null } | null;
}

const API = '/api/system-prompts';

/** Client HTTP des prompts système (admin uniquement). */
@Injectable({ providedIn: 'root' })
export class SystemPromptsService {
  private readonly http = inject(HttpClient);

  list(): Observable<SystemPrompt[]> {
    return this.http.get<SystemPrompt[]>(API);
  }

  getByName(name: string): Observable<SystemPrompt> {
    return this.http.get<SystemPrompt>(`${API}/${encodeURIComponent(name)}`);
  }

  update(name: string, dto: UpdateSystemPromptDto): Observable<SystemPrompt> {
    return this.http.patch<SystemPrompt>(`${API}/${encodeURIComponent(name)}`, dto);
  }
}
