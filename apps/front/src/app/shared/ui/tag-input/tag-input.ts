import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

/**
 * Champ de saisie de tags / compétences.
 *
 * Composant présentationnel : il prend la liste en `model()` et notifie
 * le parent à chaque ajout / suppression. Le parent reste maître de la
 * source de vérité et applique sa propre logique de persistance.
 */
@Component({
  selector: 'app-tag-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex flex-wrap items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-2.5 py-2 text-sm shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 transition"
    >
      @for (tag of value(); track tag; let i = $index) {
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
        >
          {{ tag }}
          <button
            type="button"
            class="rounded-full p-0.5 text-brand-700/60 hover:bg-brand-100 hover:text-brand-900 transition"
            [attr.aria-label]="'Retirer ' + tag"
            (click)="removeAt(i)"
          >
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </span>
      }
      <input
        type="text"
        [value]="draft()"
        [placeholder]="placeholder()"
        (input)="onDraftInput($any($event.target).value)"
        (keydown)="onKeyDown($event)"
        (blur)="commitDraft()"
        class="min-w-[120px] flex-1 bg-transparent text-sm text-surface-900 placeholder:text-surface-900/40 focus:outline-none"
      />
    </div>
    @if (helper(); as h) {
      <p class="mt-1 text-xs text-surface-900/50">{{ h }}</p>
    }
  `,
})
export class TagInput {
  readonly value = model<ReadonlyArray<string>>([]);
  readonly placeholder = input<string>('Ajouter et appuyer sur Entrée…');
  readonly helper = input<string | null>('Séparez avec « , » ou la touche Entrée.');
  readonly maxLength = input<number>(100);

  protected readonly draft = signal('');
  protected readonly canAdd = computed(
    () => this.draft().trim().length > 0 && this.draft().length <= this.maxLength(),
  );

  protected onDraftInput(next: string): void {
    if (next.endsWith(',')) {
      this.draft.set(next.slice(0, -1));
      this.commitDraft();
      return;
    }
    this.draft.set(next);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitDraft();
      return;
    }
    if (event.key === 'Backspace' && this.draft().length === 0 && this.value().length > 0) {
      this.removeAt(this.value().length - 1);
    }
  }

  protected commitDraft(): void {
    const candidate = this.draft().trim();
    if (!candidate) return;
    if (candidate.length > this.maxLength()) return;
    if (this.value().includes(candidate)) {
      this.draft.set('');
      return;
    }
    this.value.update((current) => [...current, candidate]);
    this.draft.set('');
  }

  protected removeAt(index: number): void {
    this.value.update((current) => current.filter((_, i) => i !== index));
  }
}
