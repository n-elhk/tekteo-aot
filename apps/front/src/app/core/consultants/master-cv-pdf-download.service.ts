import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CvTemplateValue } from '@org/schemas';
import { ConsultantsService } from './consultants.service';
import { ToastService } from '../notifications/toast.service';

@Injectable({ providedIn: 'root' })
export class MasterCvPdfDownloadService {
  private readonly api = inject(ConsultantsService);
  private readonly toaster = inject(ToastService);

  async trigger(
    consultantId: string,
    template: CvTemplateValue,
  ): Promise<void> {
    const toastId = this.toaster.info({
      title: 'Génération du CV maître…',
      description: 'Le téléchargement démarrera automatiquement.',
      durationMs: 0,
    });
    try {
      const { blob, filename } = await firstValueFrom(
        this.api.downloadMasterPdf(consultantId, template),
      );
      this.toaster.dismiss(toastId);
      triggerBlobDownload(blob, filename);
      this.toaster.success({
        title: 'CV maître prêt',
        description: filename,
      });
    } catch (err) {
      this.toaster.dismiss(toastId);
      this.toaster.error({
        title: 'Échec de la génération du PDF',
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
