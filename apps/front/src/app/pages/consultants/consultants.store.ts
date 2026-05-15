import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withProps,
  withMethods,
  withComputed,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap } from 'rxjs';
import { ConsultantsService } from '../../core/consultants/consultants.service';
import type { ConsultantListItem } from '../../core/consultants/consultant.model';

interface ConsultantsState {
  items: ReadonlyArray<ConsultantListItem>;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

const initialState: ConsultantsState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
};

export const ConsultantsStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _api: inject(ConsultantsService),
  })),
  withComputed(({ total, pageSize }) => ({
    pageCount: computed(() => Math.max(1, Math.ceil(total() / pageSize()))),
  })),
  withMethods((store) => ({
    loadPage: rxMethod<number>(
      pipe(
        switchMap((page) => {
          patchState(store, { loading: true, error: null });
          return store._api.list({ page, pageSize: store.pageSize() }).pipe(
            tapResponse({
              next: (res) =>
                patchState(store, {
                  items: res.items,
                  total: res.total,
                  page: res.page,
                  pageSize: res.pageSize,
                  loading: false,
                }),
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
  })),
  withMethods((store) => ({
    remove: rxMethod<string>(
      pipe(
        switchMap((id) =>
          store._api.remove(id).pipe(
            tapResponse({
              next: () => store.loadPage(store.page()),
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
  })),
  withHooks({
    onInit(store) {
      store.loadPage(1);
    },
  }),
);
