import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvData } from '@org/schemas';

@Component({
  selector: 'app-master-cv-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = cvData();
    <div class="flex flex-col gap-7">
      @if (data.identity?.summary) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Résumé
          </p>
          <p class="text-sm leading-relaxed text-surface-900/80">
            {{ data.identity?.summary }}
          </p>
        </section>
      }

      @if (data.skills?.length) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Compétences
          </p>
          <ul class="flex flex-wrap gap-1.5">
            @for (s of data.skills; track s.name) {
              <li class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {{ s.name }}
                @if (s.level) {
                  <span class="text-brand-500/60">· {{ s.level }}/5</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.tools?.length) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Outils
          </p>
          <ul class="flex flex-wrap gap-1.5">
            @for (t of data.tools; track t) {
              <li class="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-900/70">
                {{ t }}
              </li>
            }
          </ul>
        </section>
      }

      @if (data.languages?.length) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Langues
          </p>
          <ul class="flex flex-wrap gap-x-5 gap-y-1">
            @for (l of data.languages; track l.name) {
              <li class="text-sm text-surface-900/80">
                <span class="font-medium text-surface-900">{{ l.name }}</span>
                @if (l.levelLabel) {
                  <span class="text-surface-900/50"> · {{ l.levelLabel }}</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.certifications?.length) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Certifications
          </p>
          <ul class="flex flex-col gap-1">
            @for (c of data.certifications; track c.name) {
              <li class="flex items-baseline justify-between gap-3 text-sm">
                <span class="text-surface-900/80">{{ c.name }}</span>
                @if (c.year) {
                  <span class="shrink-0 text-xs text-surface-900/40">{{ c.year }}</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.education?.length) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Formation
          </p>
          <ul class="flex flex-col gap-2">
            @for (e of data.education; track $index) {
              <li class="text-sm">
                <p class="font-medium text-surface-900">
                  {{ e.degree ?? 'Diplôme' }}
                  @if (e.year) {
                    <span class="font-normal text-surface-900/50"> · {{ e.year }}</span>
                  }
                </p>
                @if (e.school) {
                  <p class="text-surface-900/60">{{ e.school }}</p>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.experiences?.length) {
        <section>
          <p class="text-xs font-medium uppercase tracking-wider text-surface-900/40 mb-2">
            Expériences
          </p>
          <ol class="flex flex-col gap-5">
            @for (exp of data.experiences; track $index) {
              <li class="relative pl-6">
                <span
                  class="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-4 ring-brand-50"
                  aria-hidden="true"
                ></span>
                <span
                  class="absolute left-[3px] top-3.5 bottom-0 w-px bg-surface-200"
                  aria-hidden="true"
                ></span>
                <p class="font-medium text-surface-900">
                  {{ exp.role ?? 'Mission' }}
                  @if (exp.company) {
                    <span class="font-normal text-surface-900/70"> — {{ exp.company }}</span>
                  }
                </p>
                <p class="mt-0.5 text-xs text-surface-900/40">
                  @if (exp.dateStart || exp.dateEnd) {
                    {{ exp.dateStart ?? '?' }} → {{ exp.dateEnd ?? '?' }}
                  }
                  @if (exp.duration) {
                    <span> · {{ exp.duration }}</span>
                  }
                  @if (exp.location) {
                    <span> · {{ exp.location }}</span>
                  }
                </p>
                @if (exp.mission) {
                  <p class="mt-2 text-sm text-surface-900/80">{{ exp.mission }}</p>
                }
                @if (exp.activities?.length) {
                  <ul class="mt-2 list-disc list-inside space-y-1 text-sm text-surface-900/70 marker:text-brand-500">
                    @for (a of exp.activities; track $index) {
                      <li>
                        @if (a.bold) { <strong class="text-surface-900">{{ a.bold }}</strong> }
                        {{ a.text }}
                      </li>
                    }
                  </ul>
                }
                @if (exp.tech?.length) {
                  <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
                    @for (t of exp.tech; track $index) {
                      <span class="rounded-full bg-surface-100 px-2 py-0.5 text-surface-900/70">
                        @if (t.category) { <span class="font-medium text-surface-900">{{ t.category }}&nbsp;:</span> }
                        {{ t.items }}
                      </span>
                    }
                  </div>
                }
              </li>
            }
          </ol>
        </section>
      }
    </div>
  `,
})
export class MasterCvView {
  readonly cvData = input.required<CvData>();
}
