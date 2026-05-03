import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonType = 'button' | 'submit' | 'reset';

/**
 * Bouton applicatif harmonisé.
 *
 * Composant purement présentationnel : il ne gère aucun état métier
 * et expose uniquement la classe CSS et le type natif.
 */
@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
  },
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      class="relative inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all duration-200 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      [class]="buttonClass()"
    >
      @if (loading()) {
        <span class="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false);
  readonly loading = input(false);

  protected readonly hostClass = computed(() => 'inline-flex');

  protected readonly buttonClass = computed(() => {
    const base = 'rounded-xl';
    const size = sizeClasses(this.size());
    const variant = variantClasses(this.variant());
    return `${base} ${size} ${variant}`;
  });
}

function sizeClasses(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'h-9 px-3 text-sm';
    case 'lg':
      return 'h-12 px-6 text-base';
    case 'md':
    default:
      return 'h-10 px-4 text-sm';
  }
}

function variantClasses(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return 'bg-white text-surface-900 border border-surface-200 hover:border-brand-300 hover:text-brand-700 hover:shadow-sm';
    case 'ghost':
      return 'bg-transparent text-surface-900 hover:bg-surface-100';
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700 shadow-sm';
    case 'primary':
    default:
      return 'text-white bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 shadow-[0_10px_24px_-12px_rgb(59_99_255/0.6)] hover:shadow-[0_14px_32px_-12px_rgb(59_99_255/0.7)]';
  }
}
