import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/notifications/toast.service';

/**
 * Pile de toasts ancrée en bas-droite de l'écran.
 * Composant racine — à monter une seule fois (dans le `App` shell).
 */
@Component({
  selector: 'app-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 px-4 pb-4 sm:px-6 sm:pb-6',
    role: 'region',
    'aria-live': 'polite',
    'aria-label': 'Notifications',
  },
  template: `
    @for (toast of toasts(); track toast.id) {
      <div
        class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-white/95 backdrop-blur shadow-[0_18px_40px_-16px_rgb(15_23_42/0.25)] transition-all"
        [class]="variantClasses(toast.variant)"
        role="status"
      >
        <div class="flex items-start gap-3 p-4">
          <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" [class]="iconBgClass(toast.variant)">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              @switch (toast.variant) {
                @case ('success') {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L20 7" />
                }
                @case ('error') {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
                }
                @case ('warning') {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                }
                @default {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              }
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-surface-900">{{ toast.title }}</p>
            @if (toast.description; as desc) {
              <p class="mt-1 text-sm text-surface-900/70">{{ desc }}</p>
            }
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-1 text-surface-900/40 hover:bg-surface-100 hover:text-surface-900 transition"
            aria-label="Fermer la notification"
            (click)="dismiss(toast.id)"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class Toaster {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.items;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  protected variantClasses(variant: 'success' | 'error' | 'info' | 'warning'): string {
    switch (variant) {
      case 'success':
        return 'border-emerald-200/70';
      case 'error':
        return 'border-red-200/70';
      case 'warning':
        return 'border-amber-200/70';
      default:
        return 'border-surface-200/70';
    }
  }

  protected iconBgClass(variant: 'success' | 'error' | 'info' | 'warning'): string {
    switch (variant) {
      case 'success':
        return 'bg-emerald-100 text-emerald-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      case 'warning':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-brand-100 text-brand-700';
    }
  }
}
