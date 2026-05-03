import { Injectable, computed, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly durationMs: number;
}

interface ToastInput {
  readonly title: string;
  readonly description?: string;
  readonly durationMs?: number;
}

const DEFAULT_DURATION_MS = 4500;

/**
 * File de notifications applicative. Les composants UI s'abonnent au signal
 * {@link ToastService.items} et affichent une pile de toasts en bas-droite.
 *
 * Service stateful minimal : aucune logique d'affichage ici, uniquement de
 * la gestion d'état pure et déterministe.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly _items = signal<ReadonlyArray<Toast>>([]);
  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._items().length);

  success(input: ToastInput): number {
    return this.push('success', input);
  }
  error(input: ToastInput): number {
    return this.push('error', input);
  }
  info(input: ToastInput): number {
    return this.push('info', input);
  }
  warning(input: ToastInput): number {
    return this.push('warning', input);
  }

  dismiss(id: number): void {
    this._items.update((current) => current.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this._items.set([]);
  }

  private push(variant: ToastVariant, input: ToastInput): number {
    const id = ++this.nextId;
    const toast: Toast = {
      id,
      variant,
      title: input.title,
      description: input.description,
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
    };
    this._items.update((current) => [...current, toast]);
    if (toast.durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => this.dismiss(id), toast.durationMs);
    }
    return id;
  }
}
