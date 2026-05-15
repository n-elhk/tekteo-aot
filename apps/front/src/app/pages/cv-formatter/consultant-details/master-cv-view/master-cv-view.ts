import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvData } from '@org/schemas';

@Component({
  selector: 'app-master-cv-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = cvData();
    <div class="flex flex-col gap-6">
      @if (data.identity?.summary) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Résumé
          </h3>
          <p class="text-sm leading-relaxed text-gray-800">
            {{ data.identity?.summary }}
          </p>
        </section>
      }

      @if (data.skills?.length) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Compétences
          </h3>
          <ul class="flex flex-wrap gap-2">
            @for (s of data.skills; track s.name) {
              <li class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                {{ s.name }}@if (s.level) { <span class="text-blue-400"> · {{ s.level }}/5</span> }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.tools?.length) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Outils
          </h3>
          <ul class="flex flex-wrap gap-2">
            @for (t of data.tools; track t) {
              <li class="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                {{ t }}
              </li>
            }
          </ul>
        </section>
      }

      @if (data.languages?.length) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Langues
          </h3>
          <ul class="flex flex-wrap gap-4">
            @for (l of data.languages; track l.name) {
              <li class="text-sm text-gray-800">
                <span class="font-medium">{{ l.name }}</span>
                @if (l.levelLabel) {
                  <span class="text-gray-500"> — {{ l.levelLabel }}</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.certifications?.length) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Certifications
          </h3>
          <ul class="flex flex-col gap-1">
            @for (c of data.certifications; track c.name) {
              <li class="text-sm text-gray-800">
                {{ c.name }}@if (c.year) { <span class="text-gray-500"> — {{ c.year }}</span> }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.education?.length) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Formation
          </h3>
          <ul class="flex flex-col gap-2">
            @for (e of data.education; track $index) {
              <li class="text-sm">
                <p class="font-medium text-gray-800">
                  {{ e.degree ?? 'Diplôme' }}
                  @if (e.year) { <span class="text-gray-500 font-normal"> · {{ e.year }}</span> }
                </p>
                @if (e.school) {
                  <p class="text-gray-600">{{ e.school }}</p>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (data.experiences?.length) {
        <section>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Expériences
          </h3>
          <ol class="flex flex-col gap-4">
            @for (exp of data.experiences; track $index) {
              <li class="border-l-2 border-blue-200 pl-4 py-1">
                <p class="font-medium text-gray-900">
                  {{ exp.role ?? 'Mission' }}
                  @if (exp.company) {
                    <span class="text-gray-600 font-normal"> — {{ exp.company }}</span>
                  }
                </p>
                <p class="text-xs text-gray-500">
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
                  <p class="text-sm text-gray-700 mt-2">{{ exp.mission }}</p>
                }
                @if (exp.activities?.length) {
                  <ul class="mt-2 list-disc list-inside text-sm text-gray-700 space-y-1">
                    @for (a of exp.activities; track $index) {
                      <li>
                        @if (a.bold) { <strong>{{ a.bold }}</strong> }
                        {{ a.text }}
                      </li>
                    }
                  </ul>
                }
                @if (exp.tech?.length) {
                  <div class="mt-2 flex flex-wrap gap-2 text-xs">
                    @for (t of exp.tech; track $index) {
                      <span class="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        @if (t.category) { <span class="font-medium">{{ t.category }} :</span> }
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
