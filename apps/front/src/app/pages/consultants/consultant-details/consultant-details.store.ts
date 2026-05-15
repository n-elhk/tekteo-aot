import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  signalStore,
  withState,
  withProps,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { filter, forkJoin, map, pipe, switchMap } from 'rxjs';
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
  withProps(() => ({
    _consultantsApi: inject(ConsultantsService),
    _variantsApi: inject(CvVariantsService),
    _route: inject(ActivatedRoute),
    _router: inject(Router),
  })),
  withMethods((store) => ({
    load: rxMethod<string>(
      pipe(
        filter(Boolean),
        switchMap((id) => {
          patchState(store, { loading: true, error: null });
          return forkJoin({
            consultant: store._consultantsApi.findOne(id),
            variants: store._variantsApi.listForConsultant(id),
          }).pipe(
            tapResponse({
              next: ({ consultant, variants }) =>
                patchState(store, { consultant, variants, loading: false }),
              error: (err: unknown) =>
                patchState(store, {
                  loading: false,
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de chargement',
                }),
            }),
          );
        }),
      ),
    ),
    createVariant: rxMethod<CreateCvVariantDto>(
      pipe(
        map((dto) => {
          const consultant = store.consultant();
          return consultant ? { dto, consultantId: consultant.id } : null;
        }),
        filter(Boolean),
        switchMap(({ dto, consultantId }) =>
          store._variantsApi.create(consultantId, dto).pipe(
            tapResponse({
              next: ({ variant }) =>
                patchState(store, {
                  variants: [variant, ...store.variants()],
                }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de création de variante',
                }),
            }),
          ),
        ),
      ),
    ),
    regenerateVariant: rxMethod<string>(
      pipe(
        switchMap((variantId) =>
          store._variantsApi.regenerate(variantId).pipe(
            tapResponse({
              next: ({ variant }) =>
                patchState(store, {
                  variants: store
                    .variants()
                    .map((v) => (v.id === variantId ? variant : v)),
                }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de régénération',
                }),
            }),
          ),
        ),
      ),
    ),
    updateVariant: rxMethod<{ variantId: string; dto: UpdateCvVariantDto }>(
      pipe(
        switchMap(({ variantId, dto }) =>
          store._variantsApi.update(variantId, dto).pipe(
            tapResponse({
              next: (variant) =>
                patchState(store, {
                  variants: store
                    .variants()
                    .map((v) => (v.id === variantId ? variant : v)),
                }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de mise à jour',
                }),
            }),
          ),
        ),
      ),
    ),
    deleteVariant: rxMethod<string>(
      pipe(
        switchMap((variantId) =>
          store._variantsApi.remove(variantId).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  variants: store
                    .variants()
                    .filter((v) => v.id !== variantId),
                }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de suppression',
                }),
            }),
          ),
        ),
      ),
    ),
    deleteConsultant: rxMethod<void>(
      pipe(
        map(() => store.consultant()),
        filter(Boolean),
        switchMap((c) =>
          store._consultantsApi.remove(c.id).pipe(
            tapResponse({
              next: () => {
                void store._router.navigate(['/consultants']);
              },
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de suppression du consultant',
                }),
            }),
          ),
        ),
      ),
    ),
    triggerVariantPdf: rxMethod<string>(
      pipe(
        switchMap((variantId) =>
          store._variantsApi.triggerPdf(variantId).pipe(
            tapResponse({
              next: (generated) =>
                patchState(store, {
                  variants: store.variants().map((v) =>
                    v.id === variantId
                      ? { ...v, generatedCvs: [generated, ...v.generatedCvs] }
                      : v,
                  ),
                }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de génération PDF',
                }),
            }),
          ),
        ),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      store.load(
        store._route.paramMap.pipe(map((p) => p.get('id') ?? '')),
      );
    },
  }),
);
