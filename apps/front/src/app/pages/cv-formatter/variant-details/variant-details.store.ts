import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { EMPTY, map, pipe, switchMap } from 'rxjs';
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
    _route: inject(ActivatedRoute),
  })),
  withMethods((store) => ({
    load: rxMethod<string>(
      pipe(
        switchMap((id) => {
          if (!id) return EMPTY;
          patchState(store, { loading: true, error: null });
          return store._api.findOne(id).pipe(
            tapResponse({
              next: (variant) =>
                patchState(store, { variant, loading: false }),
              error: (err: unknown) =>
                patchState(store, {
                  loading: false,
                  error: err instanceof Error ? err.message : 'Erreur',
                }),
            }),
          );
        }),
      ),
    ),
    saveName: rxMethod<string>(
      pipe(
        switchMap((name) => {
          const v = store.variant();
          if (!v) return EMPTY;
          return store._api.update(v.id, { name }).pipe(
            tapResponse({
              next: (variant) => patchState(store, { variant }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de sauvegarde',
                }),
            }),
          );
        }),
      ),
    ),
    saveCvData: rxMethod<CvVariant['cvData']>(
      pipe(
        switchMap((cvData) => {
          const v = store.variant();
          if (!v) return EMPTY;
          return store._api.update(v.id, { cvData }).pipe(
            tapResponse({
              next: (variant) => patchState(store, { variant }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de sauvegarde',
                }),
            }),
          );
        }),
      ),
    ),
    regenerate: rxMethod<void>(
      pipe(
        switchMap(() => {
          const v = store.variant();
          if (!v) return EMPTY;
          return store._api.regenerate(v.id).pipe(
            tapResponse({
              next: ({ variant }) => patchState(store, { variant }),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de régénération',
                }),
            }),
          );
        }),
      ),
    ),
  })),
  withMethods((store) => ({
    triggerPdf: rxMethod<void>(
      pipe(
        switchMap(() => {
          const v = store.variant();
          if (!v) return EMPTY;
          return store._api.triggerPdf(v.id).pipe(
            tapResponse({
              next: () => store.load(v.id),
              error: (err: unknown) =>
                patchState(store, {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Erreur de génération PDF',
                }),
            }),
          );
        }),
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
