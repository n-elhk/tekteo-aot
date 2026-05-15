import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { CvTemplateValue } from '@org/schemas';
import type {
  Consultant,
  ConsultantsList,
  ConsultantsListQueryDto,
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
} from './consultant.model';

export interface ConsultantImportFileJob {
  readonly jobId: string;
  readonly status: string;
}

export interface ConsultantImportJobEvent {
  readonly status: string;
  readonly consultantId?: string | null;
  readonly error?: string | null;
}

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

  downloadMasterPdf(
    consultantId: string,
    template: CvTemplateValue,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.baseUrl}/${consultantId}/master-pdf`, {
        params: { template },
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response) => ({
          blob: response.body ?? new Blob(),
          filename:
            parseFilenameFromContentDisposition(
              response.headers.get('Content-Disposition'),
            ) ?? `cv-master-${template}.pdf`,
        })),
      );
  }

  importFromFile(files: File[]) {
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    return this.http.post<{ jobs: ConsultantImportFileJob[] }>(
      `${this.baseUrl}/import/file`,
      formData,
    );
  }

  watchImportJob(jobId: string): Observable<ConsultantImportJobEvent> {
    return new Observable<ConsultantImportJobEvent>((subscriber) => {
      const source = new EventSource(
        `${this.baseUrl}/import-jobs/${jobId}/events`,
      );
      source.onmessage = (msg) => {
        try {
          subscriber.next(JSON.parse(msg.data) as ConsultantImportJobEvent);
        } catch {
          /* ignore */
        }
      };
      source.onerror = (err) => {
        subscriber.error(err);
        source.close();
      };
      return () => source.close();
    });
  }
}

function parseFilenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // fall through to ascii match
    }
  }
  const asciiMatch = /filename="?([^";]+)"?/i.exec(header);
  return asciiMatch ? asciiMatch[1] : null;
}
