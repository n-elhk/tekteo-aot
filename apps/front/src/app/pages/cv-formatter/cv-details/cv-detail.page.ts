import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, switchMap, tap } from 'rxjs';

import type {
  CvCertification,
  CvData,
  CvEducation,
  CvExperience,
  CvLanguage,
  CvSkill,
  CvTemplateValue,
  GeneratedCvDto,
} from '@org/schemas';

import { AuthStore } from '../../../core/auth/auth.store';
import type {
  ConsultantCv,
  CvIdentity,
} from '../../../core/consultant-cvs/consultant-cv.model';
import { ConsultantCvsService } from '../../../core/consultant-cvs/consultant-cvs.service';
import { APP_DIALOG_CONFIG } from '../../../core/dialog/dialog.config';
import { ToastService } from '../../../core/notifications/toast.service';
import { Button } from '../../../shared/ui/button/button';
import { Card } from '../../../shared/ui/card/card';
import {
  type ConfirmDialogData,
  ConfirmDialog,
} from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { GenerateCvDialog } from '../generate-cv-dialog';
import { GeneratedCvList } from '../generated-cv-list';
import { CvCertificationsList } from './section-list/cv-certifications-list';
import { CvEducationList } from './section-list/cv-education-list';
import { CvExperienceCard } from './section-list/cv-experience-card';
import { CvLanguagesList } from './section-list/cv-languages-list';
import { CvSkillsList } from './section-list/cv-skills-list';
import { CvToolsList } from './section-list/cv-tools-list';

type CvSectionKey =
  | 'skills'
  | 'tools'
  | 'languages'
  | 'certifications'
  | 'education'
  | 'experiences';

interface CvSection {
  readonly key: CvSectionKey;
  readonly label: string;
  readonly items: NonNullable<CvData[CvSectionKey]>;
}

const KNOWN_SECTIONS: ReadonlyArray<{ key: CvSectionKey; label: string }> = [
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
  imports: [
    RouterLink,
    Card,
    Button,
    GeneratedCvList,
    CvExperienceCard,
    CvSkillsList,
    CvToolsList,
    CvLanguagesList,
    CvCertificationsList,
    CvEducationList,
  ],
  templateUrl: './cv-detail.page.html',
})
export class CvDetailPage {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly authStore = inject(AuthStore);
  private readonly toaster = inject(ToastService);
  private readonly dialog = inject(Dialog);

  readonly id = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;

  protected readonly resource = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.cvsService.get(params),
  });

  protected readonly cv = computed<ConsultantCv | null>(
    () => this.resource.value() ?? null,
  );
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(
    () => this.resource.error() !== undefined,
  );

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
    if (!data) return [];
    return KNOWN_SECTIONS.map((meta) => {
      const raw = data[meta.key];
      const items: NonNullable<CvData[CvSectionKey]> = Array.isArray(raw)
        ? raw
        : [];
      return { key: meta.key, label: meta.label, items };
    }).filter((section) => section.items.length > 0);
  });

  protected asExperiences(
    items: ReadonlyArray<unknown>,
  ): ReadonlyArray<CvExperience> {
    return items as ReadonlyArray<CvExperience>;
  }

  protected asSkills(items: ReadonlyArray<unknown>): ReadonlyArray<CvSkill> {
    return items as ReadonlyArray<CvSkill>;
  }

  protected asTools(items: ReadonlyArray<unknown>): ReadonlyArray<string> {
    return items as ReadonlyArray<string>;
  }

  protected asLanguages(
    items: ReadonlyArray<unknown>,
  ): ReadonlyArray<CvLanguage> {
    return items as ReadonlyArray<CvLanguage>;
  }

  protected asCertifications(
    items: ReadonlyArray<unknown>,
  ): ReadonlyArray<CvCertification> {
    return items as ReadonlyArray<CvCertification>;
  }

  protected asEducation(
    items: ReadonlyArray<unknown>,
  ): ReadonlyArray<CvEducation> {
    return items as ReadonlyArray<CvEducation>;
  }

  protected stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    if (Array.isArray(value))
      return value.map((v) => this.stringify(v)).join('\n');
    if (value && typeof value === 'object')
      return Object.entries(value)
        .map(([k, v]) => `${k} : ${this.stringify(v)}`)
        .join('\n');
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

  protected onRegenerateGenerated(): void {
    void this.openGenerateDialog();
  }

  protected async onRemoveGenerated(gen: GeneratedCvDto): Promise<void> {
    const consultantId = this.cv()?.id;
    if (!consultantId) return;

    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(
      ConfirmDialog,
      {
        ...APP_DIALOG_CONFIG,
        data: {
          title: 'Supprimer ce CV généré ?',
          description: 'Le PDF sera définitivement supprimé.',
          confirmLabel: 'Supprimer',
          variant: 'danger',
        },
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

    const ref = this.dialog.open<CvTemplateValue | null>(GenerateCvDialog, {
      hasBackdrop: true,
    });

    ref.closed
      .pipe(
        filter(Boolean),
        switchMap((template) =>
          this.cvsService.generate(consultantId, template),
        ),
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

function isCvIdentity(value: unknown): value is CvIdentity {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
