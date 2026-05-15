import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CvImportSection } from '../cv-import-section/cv-import-section';
import { ConsultantManualForm } from '../consultant-manual-form/consultant-manual-form';
import { Card } from '../../../shared/ui/card/card';

type Mode = 'pick' | 'import' | 'manual';

@Component({
  selector: 'app-consultant-create',
  imports: [RouterLink, CvImportSection, ConsultantManualForm, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <a
        routerLink="/cv-formatter"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-surface-900/60 hover:text-brand-700 transition"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux consultants
      </a>

      <header>
        <p class="text-sm font-medium text-brand-700">Nouveau consultant</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight text-surface-900">
          Ajouter un consultant
        </h1>
        <p class="mt-1 max-w-2xl text-sm text-surface-900/60">
          Importez un CV existant pour extraire automatiquement l'identité,
          les compétences et les expériences, ou créez un consultant
          manuellement via le formulaire structuré.
        </p>
      </header>

      @if (mode() === 'pick') {
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            class="group flex flex-col gap-4 rounded-2xl border border-surface-200/70 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_18px_40px_-16px_rgb(59_99_255/0.25)]"
            (click)="mode.set('import')"
          >
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
              </svg>
            </span>
            <div class="space-y-1">
              <h2 class="font-semibold text-surface-900 group-hover:text-brand-800">
                Importer un CV
              </h2>
              <p class="text-sm text-surface-900/60">
                Glissez un fichier PDF ou DOCX. L'IA extrait automatiquement
                l'identité, les compétences, les expériences et les
                formations.
              </p>
            </div>
            <span class="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 group-hover:gap-2 transition-all">
              Commencer l'import
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>

          <button
            type="button"
            class="group flex flex-col gap-4 rounded-2xl border border-surface-200/70 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent-500/60 hover:shadow-[0_18px_40px_-16px_rgb(255_138_20/0.25)]"
            (click)="mode.set('manual')"
          >
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400/20 to-accent-500/20 text-accent-600">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.6a2 2 0 112.8 2.8L11 18l-4 1 1-4 9.6-9.6z" />
              </svg>
            </span>
            <div class="space-y-1">
              <h2 class="font-semibold text-surface-900 group-hover:text-accent-600">
                Créer manuellement
              </h2>
              <p class="text-sm text-surface-900/60">
                Saisissez l'identité du consultant et son CV maître via
                un formulaire structuré. Idéal pour les fiches déjà
                normalisées.
              </p>
            </div>
            <span class="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent-600 group-hover:gap-2 transition-all">
              Ouvrir le formulaire
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>
      } @else {
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-surface-900/60 hover:text-brand-700 transition"
          (click)="mode.set('pick')"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Choisir une autre méthode
        </button>

        @if (mode() === 'import') {
          <app-card title="Importer un CV">
            <app-cv-import-section (imported)="onDone()" />
          </app-card>
        } @else {
          <app-card title="Création manuelle">
            <app-consultant-manual-form (created)="onDone()" />
          </app-card>
        }
      }
    </div>
  `,
})
export class ConsultantCreatePage {
  private readonly router = inject(Router);
  protected readonly mode = signal<Mode>('pick');

  protected onDone() {
    void this.router.navigate(['/cv-formatter']);
  }
}
