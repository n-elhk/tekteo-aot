import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type {
  ConsultantCv,
  CvGenerationStatusValue,
  CvTemplateValue,
  LatestGeneratedCv,
} from '../../core/consultant-cvs/consultant-cv.model';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { ConsultantManualForm } from './consultant-manual-form';
import { GenerateCvDialog } from './generate-cv-dialog';
import { MultiFileImportZone } from './multi-file-import-zone';

const PAGE_SIZE = 20;

type Tab = 'import' | 'manual';

interface BadgeInfo {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const STATUS_BADGES: Record<CvGenerationStatusValue | 'none', BadgeInfo> = {
  none: { label: 'Aucun CV', color: '#6B7280', bg: '#F3F4F6' },
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  processing: { label: 'En cours', color: '#92400E', bg: '#FEF3C7' },
  success: { label: 'Généré', color: '#065F46', bg: '#D1FAE5' },
  failed: { label: 'Échec', color: '#991B1B', bg: '#FEE2E2' },
};

@Component({
  selector: 'app-cv-formatter-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Card,
    DatePipe,
    MultiFileImportZone,
    ConsultantManualForm,
  ],
  templateUrl: './cv-formatter.page.html',
})
export class CvFormatterPage {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);
  private readonly authStore = inject(AuthStore);
  private readonly appDialog = inject(AppDialogService);
  private readonly cdkDialog = inject(Dialog);

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly tab = signal<Tab>('import');
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly resource = rxResource({
    params: () => ({ page: this.page(), pageSize: this.pageSize }),
    stream: ({ params }) => this.cvsService.list(params),
  });

  protected readonly cvs = computed<ConsultantCv[]>(
    () => this.resource.value()?.items ?? [],
  );
  protected readonly total = computed(() => this.resource.value()?.total ?? 0);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize)),
  );
  protected readonly listLoading = computed(() => this.resource.isLoading());
  protected readonly listError = computed(
    () => this.resource.error() !== undefined,
  );

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected onImportFinished(): void {
    this.toaster.success({
      title: 'Import terminé',
      description: 'Les profils ont été ajoutés.',
    });
    this.resource.reload();
  }

  protected onManualCreated(): void {
    this.resource.reload();
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

  protected prevPage(): void {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }

  // -----------------------------------------------------------
  // Actions par ligne
  // -----------------------------------------------------------

  protected statusBadge(latest: LatestGeneratedCv | null | undefined): BadgeInfo {
    return STATUS_BADGES[latest?.status ?? 'none'];
  }

  protected onActionClick(cv: ConsultantCv): void {
    const latest = cv.latestGeneratedCv ?? null;
    if (!latest) {
      void this.openGenerateDialog(cv.id);
      return;
    }
    if (latest.status === 'success') {
      window.open(
        this.cvsService.buildDownloadUrl(cv.id, latest.id),
        '_blank',
      );
      return;
    }
    if (latest.status === 'failed') {
      void this.openGenerateDialog(cv.id);
      return;
    }
    // pending / processing → no-op
  }

  protected async deleteCv(
    cv: ConsultantCv,
    event: MouseEvent,
  ): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const ref = this.appDialog.open<ConfirmDialog, void, boolean>(
      ConfirmDialog,
      {
        data: undefined,
        providers: [
          {
            provide: ConfirmDialog.DATA,
            useValue: {
              title: 'Supprimer ce consultant ?',
              description: cv.consultantName
                ? `« ${cv.consultantName} » et tous ses CVs générés seront supprimés.`
                : 'Ce consultant et tous ses CVs générés seront supprimés.',
              confirmLabel: 'Supprimer',
              variant: 'danger' as const,
            },
          },
        ],
      },
    );
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;

    this.cvsService.remove(cv.id).subscribe({
      next: () => {
        this.toaster.success({ title: 'Consultant supprimé' });
        this.resource.reload();
      },
      error: () =>
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }

  protected initials(name: string | null | undefined): string {
    if (!name) return '?';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  // -----------------------------------------------------------
  // Mini-modale de choix de template
  // -----------------------------------------------------------

  private async openGenerateDialog(consultantId: string): Promise<void> {
    const ref = this.cdkDialog.open<CvTemplateValue | null>(GenerateCvDialog, {
      hasBackdrop: true,
    });
    const template = await firstValueFrom(ref.closed);
    if (!template) return;

    this.cvsService.generate(consultantId, template).subscribe({
      next: () => {
        this.toaster.success({
          title: 'Génération lancée',
          description: 'Le CV est en cours de production.',
        });
        setTimeout(() => this.resource.reload(), 2000);
      },
      error: () =>
        this.toaster.error({
          title: 'Génération impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }
}
