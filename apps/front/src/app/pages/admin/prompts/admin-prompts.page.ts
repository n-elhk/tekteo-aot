import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import {
  SystemPrompt,
  SystemPromptsService,
} from '../../../core/system-prompts/system-prompts.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

/** Édition des prompts système (admin uniquement). */
@Component({
  selector: 'app-admin-prompts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, DatePipe],
  templateUrl: './admin-prompts.page.html',
})
export class AdminPromptsPage {
  private readonly service = inject(SystemPromptsService);
  private readonly toaster = inject(ToastService);

  protected readonly resource = rxResource({
    stream: () => this.service.list(),
  });

  protected readonly prompts = computed<SystemPrompt[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly selectedName = signal<string | null>(null);
  protected readonly selected = computed<SystemPrompt | null>(() => {
    const name = this.selectedName();
    if (!name) return null;
    return this.prompts().find((p) => p.name === name) ?? null;
  });

  protected readonly content = signal('');
  protected readonly model = signal('');
  protected readonly saving = signal(false);

  protected readonly isDirty = computed(() => {
    const current = this.selected();
    if (!current) return false;
    return this.content() !== current.content || this.model() !== current.model;
  });

  constructor() {
    // Sélectionne le premier prompt automatiquement quand la liste arrive.
    effect(() => {
      const list = this.prompts();
      const current = this.selectedName();
      if (list.length > 0 && (!current || !list.some((p) => p.name === current))) {
        untracked(() => this.selectedName.set(list[0].name));
      }
    });

    // Synchronise les inputs locaux avec la sélection courante.
    effect(() => {
      const prompt = this.selected();
      if (!prompt) return;
      untracked(() => {
        this.content.set(prompt.content);
        this.model.set(prompt.model);
      });
    });
  }

  protected select(name: string): void {
    this.selectedName.set(name);
  }

  protected onContentChange(value: string): void {
    this.content.set(value);
  }

  protected onModelChange(value: string): void {
    this.model.set(value);
  }

  protected save(): void {
    const prompt = this.selected();
    if (!prompt || this.saving()) return;
    this.saving.set(true);
    this.service
      .update(prompt.name, { content: this.content(), model: this.model() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toaster.success({ title: 'Prompt mis à jour' });
          this.resource.reload();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.toaster.error({
            title: 'Sauvegarde impossible',
            description: extractErrorMessage(error),
          });
        },
      });
  }

}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { message?: unknown }; message?: unknown };
    const inner = maybeError.error?.message;
    if (typeof inner === 'string') return inner;
    if (typeof maybeError.message === 'string') return maybeError.message;
  }
  return 'Une erreur inattendue est survenue.';
}
