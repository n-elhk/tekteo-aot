import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { VariantDetailsStore } from './variant-details.store';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';

@Component({
  selector: 'app-variant-details',
  imports: [RouterLink, DatePipe],
  providers: [VariantDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-4">
      <a routerLink="/consultants" class="text-sm text-blue-600 hover:underline">← Retour</a>

      @if (store.loading()) {
        <p>Chargement…</p>
      } @else if (store.error(); as err) {
        <p class="text-red-600">{{ err }}</p>
      } @else if (store.variant(); as v) {
        <header class="flex justify-between items-start">
          <div class="flex-1">
            <input
              class="text-xl font-semibold w-full border rounded px-2 py-1"
              [value]="nameDraft()"
              (input)="nameDraft.set($any($event.target).value)"
              (blur)="saveName()"
            />
            <p class="text-sm text-gray-500">
              Fiche de poste : {{ v.jobProfile.title }} · Template : {{ v.template }}
            </p>
            <p class="text-xs text-gray-400">
              Modifiée le {{ v.updatedAt | date: 'dd/MM/yyyy HH:mm' }}
            </p>
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-2 rounded border" (click)="store.regenerate()">
              Régénérer (IA)
            </button>
            <button
              class="px-3 py-2 rounded bg-blue-600 text-white"
              (click)="store.triggerPdf()"
            >
              Générer PDF
            </button>
          </div>
        </header>

        <section>
          <h2 class="text-lg font-medium">Contenu (cvData)</h2>
          <textarea
            class="w-full h-96 font-mono text-xs border rounded p-2"
            [value]="cvDataDraft()"
            (input)="cvDataDraft.set($any($event.target).value)"
          ></textarea>
          <button
            class="mt-2 px-3 py-2 rounded bg-green-600 text-white"
            (click)="saveCvData()"
          >
            Enregistrer les modifications
          </button>
        </section>

        <section>
          <h2 class="text-lg font-medium">Fichiers PDF générés</h2>
          @for (g of v.generatedCvs; track g.id) {
            <div class="flex items-center gap-3 py-2 border-b">
              <span>{{ g.filename ?? g.id }}</span>
              <span class="text-xs text-gray-500">{{ g.status }}</span>
              @if (g.status === 'success') {
                <a class="text-blue-600 underline" [href]="downloadUrl(v.id, g.id)">
                  Télécharger
                </a>
              }
            </div>
          } @empty {
            <p class="text-gray-500 text-sm">Aucun PDF généré pour cette variante.</p>
          }
        </section>
      }
    </div>
  `,
})
export class VariantDetailsPage {
  protected readonly store = inject(VariantDetailsStore);
  private readonly api = inject(CvVariantsService);
  protected readonly nameDraft = signal<string>('');
  protected readonly cvDataDraft = signal<string>('');

  constructor() {
    effect(() => {
      const v = this.store.variant();
      if (v) {
        this.nameDraft.set(v.name);
        this.cvDataDraft.set(JSON.stringify(v.cvData, null, 2));
      }
    });
  }

  protected saveName() {
    this.store.saveName(this.nameDraft());
  }

  protected saveCvData() {
    try {
      const parsed = JSON.parse(this.cvDataDraft());
      this.store.saveCvData(parsed);
    } catch {
      alert('JSON invalide');
    }
  }

  protected downloadUrl(variantId: string, genId: string) {
    return this.api.downloadPdfUrl(variantId, genId);
  }
}
