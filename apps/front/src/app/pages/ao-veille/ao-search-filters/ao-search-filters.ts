import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import {
  FormField,
  FormRoot,
  form,
  required,
  submit,
} from '@angular/forms/signals';
import type { AoSearchQueryDto } from '../../../core/ao/ao.model';

export interface SearchFilterParams {
  q: string;
  exclude: string;
  region: string;
  typeMarche: string;
  procedure: string;
  deadlineDays: string;
  hidePast: boolean;
  hideAttrib: boolean;
}

export const SEARCH_FILTER_INITIAL: SearchFilterParams = {
  q: '',
  exclude: '',
  region: '',
  typeMarche: '',
  procedure: '',
  deadlineDays: '',
  hidePast: true,
  hideAttrib: true,
};

const REGIONS: ReadonlyArray<{
  value: AoSearchQueryDto['region'] | '';
  label: string;
}> = [
  { value: '', label: 'Toutes régions' },
  { value: 'IDF', label: 'Île-de-France' },
  { value: 'ARA', label: 'Auvergne-Rhône-Alpes' },
  { value: 'BFC', label: 'Bourgogne-Franche-Comté' },
  { value: 'BRE', label: 'Bretagne' },
  { value: 'CVL', label: 'Centre-Val de Loire' },
  { value: 'COR', label: 'Corse' },
  { value: 'GES', label: 'Grand Est' },
  { value: 'HDF', label: 'Hauts-de-France' },
  { value: 'NOR', label: 'Normandie' },
  { value: 'NAQ', label: 'Nouvelle-Aquitaine' },
  { value: 'OCC', label: 'Occitanie' },
  { value: 'PDL', label: 'Pays de la Loire' },
  { value: 'PAC', label: "Provence-Alpes-Côte d'Azur" },
  { value: 'DOM', label: 'DOM-TOM' },
];

const TYPES: ReadonlyArray<{
  value: AoSearchQueryDto['typeMarche'] | '';
  label: string;
}> = [
  { value: '', label: 'Tous les types' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'FOURNITURES', label: 'Fournitures' },
  { value: 'TRAVAUX', label: 'Travaux' },
];

const PROCEDURES: ReadonlyArray<{
  value: AoSearchQueryDto['procedure'] | '';
  label: string;
}> = [
  { value: '', label: 'Toutes procédures' },
  { value: 'OUVERT', label: "Appel d'offres ouvert" },
  { value: 'NEGOCIE', label: 'Procédure négociée' },
  { value: 'MAPA', label: 'MAPA' },
];

const SUGGESTIONS: ReadonlyArray<string> = [
  'ERP',
  'CRM',
  'développement',
  'cybersécurité',
  'cloud',
  'infogérance',
  'TMA',
  'MCO',
  'AMOA',
  'hébergement',
];

@Component({
  selector: 'app-ao-search-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormRoot, FormField],
  templateUrl: './ao-search-filters.html',
})
export class AoSearchFilters {
  readonly searched = output<SearchFilterParams>();
  readonly resetFilters = output<void>();

  protected readonly regions = REGIONS;
  protected readonly types = TYPES;
  protected readonly procedures = PROCEDURES;
  protected readonly suggestions = SUGGESTIONS;

  protected readonly model = signal<SearchFilterParams>({
    ...SEARCH_FILTER_INITIAL,
  });
  protected readonly searchForm = form(
    this.model,
    (p) => {
      required(p.q);
    },
    {
      submission: {
        action: async () => {
          this.searched.emit({ ...this.model() });
          return undefined;
        },
      },
    },
  );

  protected onSubmit(): void {
    void submit(this.searchForm);
  }

  protected resetSearchFilters(): void {
    this.model.set({ ...SEARCH_FILTER_INITIAL });
    this.resetFilters.emit();
  }

  protected pickSuggestion(term: string): void {
    this.model.update((m) => ({ ...m, q: term }));
    void submit(this.searchForm);
  }
}
