import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { CvImportStatusValue } from '@org/schemas';

export interface CvJobUpdate {
  status: CvImportStatusValue;
  error?: string | null;
  cvId?: string | null;
  downloadUrl?: string | null;
  consultantId?: string | null;
  generatedCvId?: string | null;
}

@Injectable()
export class CvImportEventService {
  private readonly subjects = new Map<string, Subject<CvJobUpdate>>();

  emit(jobId: string, update: CvJobUpdate): void {
    const subject = this.subjects.get(jobId);
    if (!subject) return;
    subject.next(update);
    if (update.status === 'done' || update.status === 'failed') {
      subject.complete();
      this.subjects.delete(jobId);
    }
  }

  watch(jobId: string): Observable<CvJobUpdate> {
    if (!this.subjects.has(jobId)) {
      this.subjects.set(jobId, new Subject<CvJobUpdate>());
    }
    return this.subjects.get(jobId)!.asObservable();
  }
}
