import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CvExperience } from '@org/schemas';

/**
 * Carte détaillée pour une expérience professionnelle.
 *
 * Affiche le rôle, l'entreprise, les dates, le contexte projet,
 * la mission, les activités, les résultats chiffrés et les technologies.
 */
@Component({
  selector: 'app-cv-experience-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block rounded-2xl border border-surface-200/70 bg-white p-5 shadow-sm',
  },
  template: `
    @let exp = experience();

    <!-- En-tête : rôle/entreprise à gauche, dates/durée à droite -->
    <header
      class="flex flex-col gap-2 border-b border-surface-200/60 pb-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div class="min-w-0">
        @if (exp.role; as role) {
          <h4 class="text-lg font-semibold leading-snug text-surface-900">
            {{ role }}
          </h4>
        }
        @if (exp.company; as company) {
          <p class="mt-0.5 text-sm font-medium text-surface-900/70">
            {{ company }}
          </p>
        }
      </div>

      <div class="flex flex-col items-start gap-1 lg:items-end">
        @if (dateRange(); as range) {
          <span class="text-xs font-medium uppercase tracking-wide text-surface-900/60">
            {{ range }}
          </span>
        }
        @if (exp.duration; as duration) {
          <span
            class="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
          >
            {{ duration }}
          </span>
        }
      </div>
    </header>

    <!-- Ligne meta : clientMeta + localisation -->
    @if (exp.clientMeta || exp.location) {
      <div class="mt-3 flex flex-wrap items-center gap-3">
        @if (exp.clientMeta; as clientMeta) {
          <span class="text-sm italic text-surface-900/60">{{ clientMeta }}</span>
        }
        @if (exp.location; as location) {
          <span
            class="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-900/70"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-3 w-3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 11a3 3 0 100-6 3 3 0 000 6z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 22s-7-7.58-7-12a7 7 0 0114 0c0 4.42-7 12-7 12z"
              />
            </svg>
            {{ location }}
          </span>
        }
      </div>
    }

    <!-- Bloc contexte -->
    @if (contextPills().length > 0) {
      <div class="mt-4 rounded-xl bg-surface-50 p-3">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-900/50">
          Contexte
        </p>
        <div class="flex flex-wrap gap-2">
          @for (pill of contextPills(); track pill.label) {
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-surface-900/80 ring-1 ring-surface-200"
            >
              <span class="font-semibold text-surface-900/60">{{ pill.label }} :</span>
              <span>{{ pill.value }}</span>
            </span>
          }
        </div>
      </div>
    }

    <!-- Mission -->
    @if (exp.mission; as mission) {
      <section class="mt-4">
        <h5 class="mb-1 text-xs font-semibold uppercase tracking-wider text-surface-900/50">
          Mission
        </h5>
        <p class="whitespace-pre-line text-sm leading-relaxed text-surface-900/90">
          {{ mission }}
        </p>
      </section>
    }

    <!-- Activités -->
    @if (activities().length > 0) {
      <section class="mt-4">
        <h5 class="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-900/50">
          Activités
        </h5>
        <ul class="space-y-1.5">
          @for (act of activities(); track $index) {
            <li class="flex gap-2 text-sm leading-relaxed text-surface-900/90">
              <span
                class="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500"
                aria-hidden="true"
              ></span>
              <span>
                @if (act.bold; as b) {
                  <strong class="font-semibold text-surface-900">{{ b }}</strong>
                  @if (act.text) {
                    <span> {{ act.text }}</span>
                  }
                } @else if (act.text) {
                  <span>{{ act.text }}</span>
                }
              </span>
            </li>
          }
        </ul>
      </section>
    }

    <!-- Résultats -->
    @if (results().length > 0) {
      <section class="mt-4">
        <h5 class="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-900/50">
          Résultats
        </h5>
        <div class="flex flex-wrap gap-3">
          @for (res of results(); track $index) {
            <div
              class="min-w-[7rem] flex-1 rounded-xl bg-gradient-to-br from-brand-50 to-white p-3 ring-1 ring-brand-100"
            >
              <div class="text-xl font-bold leading-tight text-brand-700">
                {{ res.value }}
              </div>
              @if (res.label; as label) {
                <div class="mt-0.5 text-xs leading-snug text-surface-900/70">
                  {{ label }}
                </div>
              }
            </div>
          }
        </div>
      </section>
    }

    <!-- Technologies -->
    @if (techEntries().length > 0) {
      <section class="mt-4">
        <h5 class="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-900/50">
          Technologies
        </h5>
        <div class="space-y-2">
          @for (tech of techEntries(); track $index) {
            <div class="flex flex-wrap items-start gap-2">
              @if (tech.category; as cat) {
                <span class="mt-0.5 text-xs font-semibold text-surface-900/70">
                  {{ cat }} :
                </span>
              }
              <div class="flex flex-wrap gap-1.5">
                @for (item of tech.items; track item) {
                  <span
                    class="inline-flex items-center rounded-md bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-900/80"
                  >
                    {{ item }}
                  </span>
                }
              </div>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class CvExperienceCard {
  readonly experience = input.required<CvExperience>();

  protected readonly dateRange = computed(() => {
    const exp = this.experience();
    const start = exp.dateStart?.trim();
    const end = exp.dateEnd?.trim();
    if (start && end) return `${start} — ${end}`;
    return start || end || null;
  });

  protected readonly contextPills = computed<ReadonlyArray<{ label: string; value: string }>>(
    () => {
      const ctx = this.experience().context;
      if (!ctx) return [];
      const pills: Array<{ label: string; value: string }> = [];
      if (ctx.team) pills.push({ label: 'Équipe', value: ctx.team });
      if (ctx.methodology)
        pills.push({ label: 'Méthodologie', value: ctx.methodology });
      if (ctx.role) pills.push({ label: 'Rôle', value: ctx.role });
      if (ctx.extraLabel && ctx.extraValue)
        pills.push({ label: ctx.extraLabel, value: ctx.extraValue });
      return pills;
    },
  );

  protected readonly activities = computed(
    () => this.experience().activities ?? [],
  );

  protected readonly results = computed(() => {
    const list = this.experience().results ?? [];
    return list.filter((r) => r.value);
  });

  protected readonly techEntries = computed<
    ReadonlyArray<{ category?: string; items: ReadonlyArray<string> }>
  >(() => {
    const list = this.experience().tech ?? [];
    return list.map((entry) => ({
      category: entry.category,
      items: splitItems(entry.items),
    }));
  });
}

function splitItems(raw: string | undefined): ReadonlyArray<string> {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
