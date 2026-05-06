import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { CreateProjectDto } from '@org/schemas';
import { ProjectsService } from '../../core/projects/projects.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

interface ProjectFormModel {
  name: string;
  clientName: string;
  marketReference: string;
  marketObject: string;
  deadline: string;
  durationMonths: string;
}

/**
 * Données de pré-remplissage transmises au formulaire via `router state`.
 * Utilisé par les flux « Créer un projet depuis un AO » et « Importer CCTP ».
 */
export interface ProjectPrefill {
  name?: string;
  clientName?: string;
  marketObject?: string;
  /** Date ISO `YYYY-MM-DD` (la portion temps est ignorée). */
  deadline?: string;
  sourceAoId?: string;
  cctpText?: string;
  cctpFilename?: string;
}

const EMPTY_MODEL: ProjectFormModel = {
  name: '',
  clientName: '',
  marketReference: '',
  marketObject: '',
  deadline: '',
  durationMonths: '',
};

const NAME_MAX_LENGTH = 100;

/**
 * Formulaire de création d'un projet AO.
 * Utilise Signal Forms et POST `/api/projects`.
 *
 * Accepte un pré-remplissage transmis via `router.navigate(['/projects/new'], { state: { prefill } })`.
 * Le `sourceAoId` est transmis au backend pour matérialiser la traçabilité AO → projet.
 * Le contenu CCTP éventuel est conservé localement et affiché sous forme de bandeau d'information ;
 * sa transmission au backend sera implémentée dans un lot ultérieur.
 */
@Component({
  selector: 'app-project-new-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormRoot, FormField, RouterLink, Card, Button],
  templateUrl: './project-new.page.html',
})
export class ProjectNewPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly model = signal<ProjectFormModel>(EMPTY_MODEL);
  protected readonly sourceAoId = signal<string | null>(null);
  protected readonly cctpText = signal<string | null>(null);
  protected readonly cctpFilename = signal<string | null>(null);

  protected readonly projectForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Le nom du projet est requis' });
      minLength(path.name, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.name, 200, { message: 'Au maximum 200 caractères' });
      required(path.clientName, { message: 'Le client est requis' });
      minLength(path.clientName, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.clientName, 200, { message: 'Au maximum 200 caractères' });
      maxLength(path.marketReference, 100, {
        message: 'Au maximum 100 caractères',
      });
      maxLength(path.marketObject, 2000, {
        message: 'Au maximum 2 000 caractères',
      });
      validate(path.durationMonths, ({ value }) => {
        const v = value().trim();
        if (!v) return undefined;
        const n = Number(v);
        return Number.isInteger(n) && n > 0
          ? undefined
          : {
              kind: 'positiveInteger',
              message: 'Saisissez un entier positif',
            };
      });
    },
    {
      submission: {
        action: async () => {
          const dto = toCreateProjectDto(this.model(), this.sourceAoId());
          try {
            const project = await firstValueFrom(this.projectsService.create(dto));
            this.toaster.success({
              title: 'Projet créé',
              description: `« ${project.name} » est prêt à être configuré.`,
            });
            this.router.navigate(['/projects', project.id]);
            return undefined;
          } catch (error: unknown) {
            this.toaster.error({
              title: 'Création impossible',
              description: extractErrorMessage(error),
            });
            return undefined;
          }
        },
        onInvalid: (field) => {
          field().markAsTouched();
        },
      },
    },
  );

  protected readonly canSubmit = computed(
    () => this.projectForm().valid() && !this.projectForm().submitting(),
  );

  constructor() {
    const prefill = this.readPrefill();
    if (prefill) {
      this.applyPrefill(prefill);
    }
  }

  protected onSubmit(): void {
    void submit(this.projectForm);
  }

  /**
   * Récupère le pré-remplissage transmis via `router state`.
   *
   * `router.getCurrentNavigation()` ne renvoie un `Navigation` que pendant
   * la transition. Lorsque le composant est instancié après navigation
   * (cas le plus fréquent), on retombe sur `history.state` qui Angular
   * sérialise via `NavigationExtras.state`.
   */
  private readPrefill(): ProjectPrefill | null {
    const fromNav = this.router.getCurrentNavigation()?.extras.state;
    const fromHistory = typeof history !== 'undefined' ? history.state : null;
    return extractPrefill(fromNav) ?? extractPrefill(fromHistory);
  }

  private applyPrefill(prefill: ProjectPrefill): void {
    const truncatedName = prefill.name
      ? prefill.name.length > NAME_MAX_LENGTH
        ? `${prefill.name.slice(0, NAME_MAX_LENGTH)}…`
        : prefill.name
      : '';
    const isoDate = prefill.deadline ? prefill.deadline.slice(0, 10) : '';

    this.model.set({
      ...EMPTY_MODEL,
      name: truncatedName,
      clientName: prefill.clientName ?? '',
      marketObject: prefill.marketObject ?? '',
      deadline: isoDate,
    });

    if (prefill.sourceAoId) this.sourceAoId.set(prefill.sourceAoId);
    if (prefill.cctpText) this.cctpText.set(prefill.cctpText);
    if (prefill.cctpFilename) this.cctpFilename.set(prefill.cctpFilename);
  }
}

function extractPrefill(state: unknown): ProjectPrefill | null {
  if (!state || typeof state !== 'object') return null;
  const candidate = (state as { prefill?: unknown }).prefill;
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as ProjectPrefill;
}

function toCreateProjectDto(
  model: ProjectFormModel,
  sourceAoId: string | null,
): CreateProjectDto {
  const trimmedReference = model.marketReference.trim();
  const trimmedObject = model.marketObject.trim();
  const trimmedDeadline = model.deadline.trim();
  const duration = parseInt(model.durationMonths, 10);

  return {
    name: model.name.trim(),
    clientName: model.clientName.trim(),
    technologies: [],
    lots: [],
    status: 'brouillon',
    ...(trimmedReference ? { marketReference: trimmedReference } : {}),
    ...(trimmedObject ? { marketObject: trimmedObject } : {}),
    ...(trimmedDeadline ? { deadline: trimmedDeadline } : {}),
    ...(Number.isFinite(duration) && duration > 0
      ? { durationMonths: duration }
      : {}),
    ...(sourceAoId ? { sourceAoId } : {}),
  };
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const inner = maybeError.error?.message;
    if (typeof inner === 'string') return inner;
    if (typeof maybeError.message === 'string') return maybeError.message;
  }
  return 'Une erreur inattendue est survenue.';
}
