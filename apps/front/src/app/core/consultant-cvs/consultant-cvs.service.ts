import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdaptCvToJobDto,
  ConsultantCv,
  CreateConsultantCvDto,
  CvImportCreatedResponse,
  CvImportJobDto,
  CvImportTemplateValue,
  FormatCvFromTextDto,
  FormatCvResponse,
  UpdateConsultantCvDto,
} from './consultant-cv.model';

const API = '/api/consultant-cvs';

/** Client HTTP pour les CV consultants. */
@Injectable({ providedIn: 'root' })
export class ConsultantCvsService {
  private readonly http = inject(HttpClient);

  list(): Observable<ConsultantCv[]> {
    return this.http.get<ConsultantCv[]>(API);
  }

  get(id: string): Observable<ConsultantCv> {
    return this.http.get<ConsultantCv>(`${API}/${id}`);
  }

  create(dto: CreateConsultantCvDto): Observable<ConsultantCv> {
    return this.http.post<ConsultantCv>(API, dto);
  }

  update(id: string, dto: UpdateConsultantCvDto): Observable<ConsultantCv> {
    return this.http.patch<ConsultantCv>(`${API}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }

  formatFromText(dto: FormatCvFromTextDto): Observable<FormatCvResponse> {
    return this.http.post<FormatCvResponse>(`${API}/format-from-text`, dto);
  }

  adaptToJob(id: string, dto: AdaptCvToJobDto): Observable<FormatCvResponse> {
    return this.http.post<FormatCvResponse>(`${API}/${id}/adapt-to-job`, dto);
  }

  // ----------------------------------------------------------
  // Import async depuis fichier PDF/DOCX
  // ----------------------------------------------------------

  importFromFile(
    file: File,
    templateId: CvImportTemplateValue,
  ): Observable<CvImportCreatedResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('templateId', templateId);
    return this.http.post<CvImportCreatedResponse>(
      `${API}/import-from-file`,
      form,
    );
  }

  getImportJob(jobId: string): Observable<CvImportJobDto> {
    return this.http.get<CvImportJobDto>(`${API}/import-jobs/${jobId}`);
  }

  watchImportJob(jobId: string): Observable<Partial<CvImportJobDto>> {
    return new Observable((observer) => {
      const source = new EventSource(`${API}/import-jobs/${jobId}/events`, {
        withCredentials: true,
      });
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as Partial<CvImportJobDto>;
        observer.next(data);
        if (data.status === 'done' || data.status === 'failed') {
          source.close();
          observer.complete();
        }
      };
      source.onerror = () => {
        source.close();
        observer.error(new Error('Connexion SSE perdue'));
      };
      return () => source.close();
    });
  }

  downloadImport(jobId: string): Observable<Blob> {
    return this.http.get(`${API}/import-jobs/${jobId}/download`, {
      responseType: 'blob',
    });
  }
}
