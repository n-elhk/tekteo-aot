import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import {
  FormField,
  FormRoot,
  form,
  required,
  submit,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import {
  SystemPrompt,
  SystemPromptsService,
} from '../../../core/system-prompts/system-prompts.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

const CLAUDE_MODELS = [
  {
    value: 'claude-opus-4-7',
    label: 'claude-opus-4-7 (Opus 4.7 — le plus puissant)',
  },
  {
    value: 'claude-sonnet-4-6',
    label: 'claude-sonnet-4-6 (Sonnet 4.6 — équilibré)',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'claude-haiku-4-5-20251001 (Haiku 4.5 — rapide)',
  },
] as const;

interface PromptFormModel {
  content: string;
  model: string;
}

/** Édition des prompts système (admin uniquement). */
@Component({
  selector: 'app-admin-prompts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, DatePipe, FormRoot, FormField],
  templateUrl: './admin-prompts.page.html',
})
export class AdminPromptsPage {
  private readonly service = inject(SystemPromptsService);
  private readonly toaster = inject(ToastService);

  protected readonly resource = rxResource({
    stream: () => this.service.list(),
    defaultValue: [],
  });

  protected readonly prompts = computed(() => this.resource.value());
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(
    () => this.resource.error() !== undefined,
  );

  // Auto-sélectionne le premier prompt au chargement, conserve la sélection si elle existe encore.
  protected readonly selectedName = linkedSignal({
    source: this.prompts,
    computation: (list, previous) => {
      if (previous?.value && list.some((p) => p.name === previous.value)) {
        return previous.value;
      }
      return list[0]?.name ?? null;
    },
  });

  protected readonly selected = computed<SystemPrompt | null>(() => {
    const name = this.selectedName();
    if (!name) return null;
    return this.prompts().find((p) => p.name === name) ?? null;
  });

  protected readonly claudeModels = CLAUDE_MODELS;

  // Se réinitialise automatiquement quand la sélection change.
  protected readonly formModel = linkedSignal<PromptFormModel>(() => {
    const prompt = this.selected();
    return { content: prompt?.content ?? '', model: prompt?.model ?? '' };
  });

  protected readonly promptForm = form(
    this.formModel,
    (p) => {
      required(p.model);
    },
    {
      submission: {
        action: async () => {
          const prompt = this.selected();
          if (!prompt) return undefined;
          const { content, model } = this.formModel();
          try {
            await firstValueFrom(
              this.service.update(prompt.name, { content, model }),
            );
            this.toaster.success({ title: 'Prompt mis à jour' });
            this.resource.reload();
          } catch (error: unknown) {
            this.toaster.error({
              title: 'Sauvegarde impossible',
              description: extractErrorMessage(error),
            });
          }
          return undefined;
        },
      },
    },
  );

  protected readonly isDirty = computed(() => {
    const current = this.selected();
    if (!current) return false;
    const { content, model } = this.formModel();
    return content !== current.content || model !== current.model;
  });

  protected select(name: string): void {
    this.selectedName.set(name);
  }

  protected save(): void {
    void submit(this.promptForm);
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const inner = maybeError.error?.message;
    if (typeof inner === 'string') return inner;
    if (typeof maybeError.message === 'string') return maybeError.message;
  }
  return 'Une erreur inattendue est survenue.';
}
