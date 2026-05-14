import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, switchMap, tap } from 'rxjs';
import { EMPTY_PAGINATED_RESPONSE } from '@org/types';
import { ConsultantCvsService } from '../../../core/consultant-cvs/consultant-cvs.service';
import type {
  ConsultantCv,
  CvGenerationStatusValue,
  CvTemplateValue,
  LatestGeneratedCv,
} from '../../../core/consultant-cvs/consultant-cv.model';
import { ToastService } from '../../../core/notifications/toast.service';
import { APP_DIALOG_CONFIG } from '../../../core/dialog/dialog.config';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { GenerateCvDialog } from '../generate-cv-dialog';

const PAGE_SIZE = 20;

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

/**
 * Section "Consultants enregistrés" : liste paginée + actions par ligne
 * (téléchargement, génération, suppression).
 *
 * Expose une méthode publique `reload()` pour permettre au parent de
 * rafraîchir la liste après un import ou une création manuelle.
 */
@Component({
  selector: 'app-consultant-list-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './consultant-list-section.html',
})
export class ConsultantListSection {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);
  private readonly dialog = inject(Dialog);

  readonly canEdit = input<boolean>(false);

  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly resource = rxResource({
    params: () => ({ page: this.page(), pageSize: this.pageSize }),
    stream: ({ params }) => this.cvsService.list(params),
    defaultValue: EMPTY_PAGINATED_RESPONSE,
  });

  protected readonly cvs = computed(() => this.resource.value().items);
  protected readonly total = computed(() => this.resource.value().total);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize)),
  );
  protected readonly listLoading = computed(() => this.resource.isLoading());
  protected readonly listError = computed(
    () => this.resource.error() !== undefined,
  );

  /** Recharge la liste — appelé par le parent après un import/création. */
  reload(): void {
    this.resource.reload();
  }

  // -----------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

  protected prevPage(): void {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }

  // -----------------------------------------------------------
  // Affichage
  // -----------------------------------------------------------

  protected statusBadge(
    latest: LatestGeneratedCv | null | undefined,
  ): BadgeInfo {
    return STATUS_BADGES[latest?.status ?? 'none'];
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
  // Actions par ligne
  // -----------------------------------------------------------

  protected onActionClick(cv: ConsultantCv): void {
    const latest = cv.latestGeneratedCv ?? null;
    if (!latest) {
      this.openGenerateDialog(cv.id);
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
      this.openGenerateDialog(cv.id);
      return;
    }
    // pending / processing → no-op
  }

  protected deleteCv(cv: ConsultantCv, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(
      ConfirmDialog,
      {
        ...APP_DIALOG_CONFIG,
        data: {
          title: 'Supprimer ce CV ?',
          description: cv.consultantName
            ? `Le CV de « ${cv.consultantName} » sera définitivement supprimé.`
            : 'Ce CV sera définitivement supprimé.',
          confirmLabel: 'Supprimer',
          variant: 'danger',
        },
      },
    );

    ref.closed
      .pipe(
        filter(Boolean),
        switchMap(() => this.cvsService.remove(cv.id)),
        tap(() => {
          this.toaster.success({ title: 'Consultant supprimé' });
          this.resource.reload();
        }),
      )
      .subscribe({
        error: () =>
          this.toaster.error({
            title: 'Suppression impossible',
            description: 'Veuillez réessayer dans un instant.',
          }),
      });
  }

  private openGenerateDialog(consultantId: string): void {
    const ref = this.dialog.open<CvTemplateValue | null>(GenerateCvDialog, {
      hasBackdrop: true,
    });

    ref.closed
      .pipe(
        filter(Boolean),
        switchMap((tpl) => this.cvsService.generate(consultantId, tpl)),
        tap(() => {
          this.toaster.success({
            title: 'Génération lancée',
            description: 'Le CV est en cours de production.',
          });
          this.resource.reload();
        }),
      )
      .subscribe({
        error: () =>
          this.toaster.error({
            title: 'Génération impossible',
            description: 'Veuillez réessayer dans un instant.',
          }),
      });
  }
}
