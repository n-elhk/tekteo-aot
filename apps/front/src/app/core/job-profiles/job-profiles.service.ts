import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CreateJobProfileDto,
  GenerateJobProfilesDto,
  UpdateJobProfileDto,
} from '@org/schemas';
import {
  GenerateJobProfilesResult,
  JobProfile,
} from './job-profile.model';

const API = '/api';

/** Client HTTP pour les fiches de poste (job profiles). */
@Injectable({ providedIn: 'root' })
export class JobProfilesService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string): Observable<JobProfile[]> {
    return this.http.get<JobProfile[]>(`${API}/projects/${projectId}/job-profiles`);
  }

  get(id: string): Observable<JobProfile> {
    return this.http.get<JobProfile>(`${API}/job-profiles/${id}`);
  }

  create(projectId: string, dto: CreateJobProfileDto): Observable<JobProfile> {
    return this.http.post<JobProfile>(
      `${API}/projects/${projectId}/job-profiles`,
      dto,
    );
  }

  update(id: string, dto: UpdateJobProfileDto): Observable<JobProfile> {
    return this.http.patch<JobProfile>(`${API}/job-profiles/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/job-profiles/${id}`);
  }

  generateBatch(
    projectId: string,
    dto: GenerateJobProfilesDto,
  ): Observable<GenerateJobProfilesResult> {
    return this.http.post<GenerateJobProfilesResult>(
      `${API}/projects/${projectId}/job-profiles/generate-batch`,
      dto,
    );
  }
}
