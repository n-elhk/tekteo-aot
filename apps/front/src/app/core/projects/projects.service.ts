import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Project } from '@org/types';
import type { CreateProjectDto, UpdateProjectDto } from '@org/schemas';

const PROJECTS_BASE = '/api/projects';

/**
 * Client HTTP pour les opérations CRUD sur les projets AO.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);

  list(): Observable<Project[]> {
    return this.http.get<Project[]>(PROJECTS_BASE);
  }

  get(id: string): Observable<Project> {
    return this.http.get<Project>(`${PROJECTS_BASE}/${id}`);
  }

  create(dto: CreateProjectDto): Observable<Project> {
    return this.http.post<Project>(PROJECTS_BASE, dto);
  }

  update(id: string, dto: UpdateProjectDto): Observable<Project> {
    return this.http.patch<Project>(`${PROJECTS_BASE}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${PROJECTS_BASE}/${id}`);
  }
}
