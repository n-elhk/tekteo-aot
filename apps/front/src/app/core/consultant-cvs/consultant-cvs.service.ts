import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdaptCvToJobDto,
  ConsultantCv,
  ConsultantCvsPage,
  CreateConsultantCvDto,
  CvGenerationResponse,
  CvImportBulkResponse,
  CvJobEventDto,
  CvTemplateValue,
  FormatCvFromTextDto,
  FormatCvResponse,
  UpdateConsultantCvDto,
} from './consultant-cv.model';

const API = '/api/consultant-cvs';

/** Client HTTP pour les profils consultants et leurs CV générés. */
@Injectable({ providedIn: 'root' })
export class ConsultantCvsService {
  private readonly http = inject(HttpClient);

  list(params: {
    page: number;
    pageSize: number;
  }): Observable<ConsultantCvsPage> {
    const httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);
    return this.http.get<ConsultantCvsPage>(API, { params: httpParams });
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

  // -----------------------------------------------------------
  // Import multi-fichier
  // -----------------------------------------------------------

  importMultipleFiles(
    files: File[],
    template: CvTemplateValue,
  ): Observable<CvImportBulkResponse> {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    form.append('template', template);
    return this.http.post<CvImportBulkResponse>(
      `${API}/import-from-file`,
      form,
    );
  }

  watchImportJob(jobId: string): Observable<Partial<CvJobEventDto>> {
    return new Observable((observer) => {
      const source = new EventSource(
        `${API}/import-jobs/${jobId}/events`,
        { withCredentials: true },
      );
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as Partial<CvJobEventDto>;
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

  // -----------------------------------------------------------
  // Génération depuis détail
  // -----------------------------------------------------------

  generate(
    consultantId: string,
    template: CvTemplateValue,
  ): Observable<CvGenerationResponse> {
    return this.http.post<CvGenerationResponse>(
      `${API}/${consultantId}/generate`,
      { template },
    );
  }

  // -----------------------------------------------------------
  // CVs générés — download / delete
  // -----------------------------------------------------------

  /** URL absolue pour ouvrir le PDF dans un nouvel onglet ou déclencher download. */
  buildDownloadUrl(consultantId: string, genId: string): string {
    return `${API}/${consultantId}/generated-cvs/${genId}/download`;
  }

  removeGeneratedCv(
    consultantId: string,
    genId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${API}/${consultantId}/generated-cvs/${genId}`,
    );
  }
}
