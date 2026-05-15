import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withProps,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';
import type { CvVariant } from '../../../core/cv-variants/cv-variant.model';

interface State {
  variant: CvVariant | null;
  loading: boolean;
  error: string | null;
}

const initial: State = { variant: null, loading: false, error: null };

export const VariantDetailsStore = signalStore(
  withState(initial),
  withProps(() => ({
    _api: inject(CvVariantsService),
  })),
  withMethods((store) => ({
    async load(id: string) {
      patchState(store, { loading: true, error: null });
      try {
        const variant = await firstValueFrom(store._api.findOne(id));
        patchState(store, { variant, loading: false });
      } catch (err) {
        patchState(store, {
          loading: false,
          error: err instanceof Error ? err.message : 'Erreur',
        });
      }
    },
    async saveName(name: string) {
      const v = store.variant();
      if (!v) return;
      const updated = await firstValueFrom(store._api.update(v.id, { name }));
      patchState(store, { variant: updated });
    },
    async saveCvData(cvData: CvVariant['cvData']) {
      const v = store.variant();
      if (!v) return;
      const updated = await firstValueFrom(store._api.update(v.id, { cvData }));
      patchState(store, { variant: updated });
    },
    async regenerate() {
      const v = store.variant();
      if (!v) return;
      const { variant } = await firstValueFrom(store._api.regenerate(v.id));
      patchState(store, { variant });
    },
    async triggerPdf() {
      const v = store.variant();
      if (!v) return;
      await firstValueFrom(store._api.triggerPdf(v.id));
      await this.load(v.id);
    },
  })),
);
