import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type {
  ConsultantCv,
  CvIdentity,
  CvTemplateValue,
  GeneratedCvDto,
} from '../../core/consultant-cvs/consultant-cv.model';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { GenerateCvDialog } from './generate-cv-dialog';
import { GeneratedCvList } from './generated-cv-list';

interface CvSection {
  readonly key: string;
  readonly label: string;
  readonly items: ReadonlyArray<unknown>;
}

const KNOWN_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'experiences', label: 'Expériences professionnelles' },
  { key: 'skills', label: 'Compétences' },
  { key: 'tools', label: 'Outils & technologies' },
  { key: 'languages', label: 'Langues' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'education', label: 'Formation' },
];

/**
 * Page de visualisation d'un CV consultant structuré.
 *
 * Affiche l'identité et chaque section du CvData de manière générique
 * — la structure interne est libre côté backend.
 */
@Component({
  selector: 'app-cv-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, GeneratedCvList],
  templateUrl: './cv-detail.page.html',
})
export class CvDetailPage {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly authStore = inject(AuthStore);
  private readonly toaster = inject(ToastService);
  private readonly appDialog = inject(AppDialogService);
  private readonly cdkDialog = inject(Dialog);

  readonly id = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;

  protected readonly resource = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.cvsService.get(params),
  });

  protected readonly cv = computed<ConsultantCv | null>(() => this.resource.value() ?? null);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly generatedCvs = computed<GeneratedCvDto[]>(
    () => (this.cv()?.generatedCvs as GeneratedCvDto[] | undefined) ?? [],
  );

  protected readonly identity = computed<CvIdentity>(() => {
    const data = this.cv()?.cvData;
    if (!data || typeof data !== 'object') return {};
    const identity = (data as { identity?: unknown }).identity;
    return isCvIdentity(identity) ? identity : {};
  });

  protected readonly sections = computed<CvSection[]>(() => {
    const data = this.cv()?.cvData;
    if (!data || typeof data !== 'object') return [];
    return KNOWN_SECTIONS.map((meta) => {
      const raw = (data as Record<string, unknown>)[meta.key];
      const items = Array.isArray(raw) ? raw : [];
      return { key: meta.key, label: meta.label, items };
    }).filter((section) => section.items.length > 0);
  });

  protected stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[objet]';
      }
    }
    return '';
  }

  protected isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  protected entries(value: unknown): ReadonlyArray<[string, unknown]> {
    if (!this.isObject(value)) return [];
    return Object.entries(value);
  }

  // -----------------------------------------------------------
  // Génération de CV depuis le détail
  // -----------------------------------------------------------

  protected onDownloadGenerated(gen: GeneratedCvDto): void {
    const id = this.cv()?.id;
    if (!id) return;
    window.open(this.cvsService.buildDownloadUrl(id, gen.id), '_blank');
  }

  protected onRegenerateGenerated(_gen: GeneratedCvDto): void {
    void this.openGenerateDialog();
  }

  protected async onRemoveGenerated(gen: GeneratedCvDto): Promise<void> {
    const consultantId = this.cv()?.id;
    if (!consultantId) return;

    const ref = this.appDialog.open<ConfirmDialog, void, boolean>(
      ConfirmDialog,
      {
        data: undefined,
        providers: [
          {
            provide: ConfirmDialog.DATA,
            useValue: {
              title: 'Supprimer ce CV généré ?',
              description: 'Le PDF sera définitivement supprimé.',
              confirmLabel: 'Supprimer',
              variant: 'danger' as const,
            },
          },
        ],
      },
    );
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;

    this.cvsService.removeGeneratedCv(consultantId, gen.id).subscribe({
      next: () => {
        this.toaster.success({ title: 'CV supprimé' });
        this.resource.reload();
      },
      error: () =>
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }

  protected async openGenerateDialog(): Promise<void> {
    const consultantId = this.cv()?.id;
    if (!consultantId) return;
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

function isCvIdentity(value: unknown): value is CvIdentity {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
