import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ConsultantsService } from '../../../core/consultants/consultants.service';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';
import type { Consultant } from '../../../core/consultants/consultant.model';
import type {
  CreateCvVariantDto,
  CvVariant,
  UpdateCvVariantDto,
} from '../../../core/cv-variants/cv-variant.model';

interface State {
  consultant: Consultant | null;
  variants: CvVariant[];
  loading: boolean;
  error: string | null;
}

const initialState: State = {
  consultant: null,
  variants: [],
  loading: false,
  error: null,
};

export const ConsultantDetailsStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const consultantsApi = inject(ConsultantsService);
    const variantsApi = inject(CvVariantsService);
    return {
      async load(id: string) {
        patchState(store, { loading: true, error: null });
        try {
          const [consultant, variants] = await Promise.all([
            firstValueFrom(consultantsApi.findOne(id)),
            firstValueFrom(variantsApi.listForConsultant(id)),
          ]);
          patchState(store, { consultant, variants, loading: false });
        } catch (err) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Erreur de chargement',
          });
        }
      },
      async createVariant(dto: CreateCvVariantDto) {
        const consultant = store.consultant();
        if (!consultant) return;
        const { variant } = await firstValueFrom(variantsApi.create(consultant.id, dto));
        patchState(store, { variants: [variant, ...store.variants()] });
      },
      async regenerateVariant(variantId: string) {
        const { variant } = await firstValueFrom(variantsApi.regenerate(variantId));
        patchState(store, {
          variants: store.variants().map((v) => (v.id === variantId ? variant : v)),
        });
      },
      async updateVariant(variantId: string, dto: UpdateCvVariantDto) {
        const variant = await firstValueFrom(variantsApi.update(variantId, dto));
        patchState(store, {
          variants: store.variants().map((v) => (v.id === variantId ? variant : v)),
        });
      },
      async deleteVariant(variantId: string) {
        await firstValueFrom(variantsApi.remove(variantId));
        patchState(store, {
          variants: store.variants().filter((v) => v.id !== variantId),
        });
      },
    };
  }),
);
