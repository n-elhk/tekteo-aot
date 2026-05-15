import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withProps,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
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
    async loadPage(page: number, pageSize = store.pageSize()) {
      patchState(store, { loading: true, error: null });
      try {
        const res = await firstValueFrom(store._api.list({ page, pageSize }));
        patchState(store, {
          items: res.items,
          total: res.total,
          page: res.page,
          pageSize: res.pageSize,
          loading: false,
        });
      } catch (err) {
        patchState(store, {
          loading: false,
          error: err instanceof Error ? err.message : 'Erreur de chargement',
        });
      }
    },
    async remove(id: string) {
      await firstValueFrom(store._api.remove(id));
      await this.loadPage(store.page());
    },
  })),
);
