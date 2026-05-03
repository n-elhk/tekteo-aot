import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type { ConsultantCv, CvIdentity } from '../../core/consultant-cvs/consultant-cv.model';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

interface CvSection {
  readonly key: string;
  readonly label: string;
  readonly items: ReadonlyArray<unknown>;
}

const KNOWN_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'experiences', label: 'Expériences professionnelles' },
  { key: 'skills', label: 'Compétences' },
  { key: 'tools', label: 'Outils & technologies' },
  { key: 'languages', label: 'Langues' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'education', label: 'Formation' },
];

/**
 * Page de visualisation d'un CV consultant structuré.
 *
 * Affiche l'identité et chaque section du CvData de manière générique
 * — la structure interne est libre côté backend.
 */
@Component({
  selector: 'app-cv-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button],
  templateUrl: './cv-detail.page.html',
})
export class CvDetailPage {
  private readonly cvsService = inject(ConsultantCvsService);

  readonly id = input.required<string>();

  protected readonly resource = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.cvsService.get(params),
  });

  protected readonly cv = computed<ConsultantCv | null>(() => this.resource.value() ?? null);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly identity = computed<CvIdentity>(() => {
    const data = this.cv()?.cvData;
    if (!data || typeof data !== 'object') return {};
    const identity = (data as { identity?: unknown }).identity;
    return isCvIdentity(identity) ? identity : {};
  });

  protected readonly sections = computed<CvSection[]>(() => {
    const data = this.cv()?.cvData;
    if (!data || typeof data !== 'object') return [];
    return KNOWN_SECTIONS.map((meta) => {
      const raw = (data as Record<string, unknown>)[meta.key];
      const items = Array.isArray(raw) ? raw : [];
      return { key: meta.key, label: meta.label, items };
    }).filter((section) => section.items.length > 0);
  });

  protected stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[objet]';
      }
    }
    return '';
  }

  protected isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  protected entries(value: unknown): ReadonlyArray<[string, unknown]> {
    if (!this.isObject(value)) return [];
    return Object.entries(value);
  }
}

function isCvIdentity(value: unknown): value is CvIdentity {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
